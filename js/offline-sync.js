// ========================================
// OFFLINE & SYNC MANAGER
// ========================================

const OfflineManager = {
    // Check if online
    isOnline: () => navigator.onLine,

    // Queue an action to be performed when online
    // Action format: { type: 'save_order', data: object, id: string, timestamp: number }
    queueAction: (action) => {
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        queue.push(action);
        localStorage.setItem('sync_queue', JSON.stringify(queue));
        console.log('🔌 Action queued (Offline):', action.type);
        OfflineManager.updateUI(false);
    },

    // Try to process the queue
    processQueue: async () => {
        if (!OfflineManager.isOnline()) return;

        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        if (queue.length === 0) {
            OfflineManager.updateUI(true);
            return;
        }

        console.log('🔄 Syncing...', queue.length, 'items pending');

        // Process items one by one
        // Note: In a real production app, we might batch these or handle dependency order specifically
        const remainingQueue = [];

        for (const action of queue) {
            try {
                let error = null;

                if (action.type === 'save_order') {
                    const { error: err } = await db.from('active_orders').upsert({
                        id: action.data.id,
                        type: action.data.type,
                        status: action.data.status,
                        customer_json: action.data.customer,
                        order_json: action.data.order,
                        notes: action.data.notes,
                        timestamp: action.data.timestamp
                    });
                    error = err;
                } else if (action.type === 'save_table') {
                    const { error: err } = await db.from('tables').update({
                        status: action.data.status,
                        order_json: action.data.order,
                        notes: action.data.notes
                    }).eq('id', action.data.id);
                    error = err;
                } else if (action.type === 'save_sale') {
                    const { error: err } = await db.from('sales_log').insert({
                        id: action.data.id,
                        ref_id: action.data.ref_id,
                        type: action.data.type,
                        total: action.data.total,
                        method: action.data.method,
                        items_json: action.data.items,
                        date: action.data.date
                    });
                    error = err;
                } else if (action.type === 'delete_order') {
                    const { error: err } = await db.from('active_orders').delete().eq('id', action.data);
                    error = err;
                }

                if (error) {
                    console.error('❌ Sync failed for item:', action, error);
                    remainingQueue.push(action); // Keep in queue to retry
                } else {
                    console.log('✅ Synced:', action.type);
                }

            } catch (e) {
                console.error('❌ Sync exception:', e);
                remainingQueue.push(action);
            }
        }

        localStorage.setItem('sync_queue', JSON.stringify(remainingQueue));

        if (remainingQueue.length === 0) {
            console.log('✨ Sync Complete!');
            OfflineManager.updateUI(true);
        } else {
            console.warn('⚠️ Sync incomplete, some items failed.');
        }
    },

    // Update UI status indicator
    updateUI: (online) => {
        let indicator = document.getElementById('offline-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '20px';
            indicator.style.left = '20px';
            indicator.style.padding = '10px 15px';
            indicator.style.borderRadius = '50px';
            indicator.style.color = 'white';
            indicator.style.fontWeight = 'bold';
            indicator.style.fontSize = '0.9rem';
            indicator.style.zIndex = '9999';
            indicator.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
            document.body.appendChild(indicator);
        }

        const queueCount = JSON.parse(localStorage.getItem('sync_queue') || '[]').length;

        if (online && queueCount === 0) {
            indicator.style.display = 'none'; // Everything good, hide it
            // Or show green dot?
            // indicator.style.backgroundColor = '#22c55e';
            // indicator.textContent = '🟢 Online';
        } else {
            indicator.style.display = 'block';
            if (online) {
                indicator.style.backgroundColor = '#eab308'; // Yeellow syncing
                indicator.textContent = `🔄 Sincronizando (${queueCount})...`;
            } else {
                indicator.style.backgroundColor = '#ef4444'; // Red offline
                indicator.textContent = `📡 OFFLINE (${queueCount} pendientes)`;
            }
        }
    },

    init: () => {
        window.addEventListener('online', () => {
            console.log('🌐 Connection restored');
            OfflineManager.processQueue();
        });
        window.addEventListener('offline', () => {
            console.log('🔌 Connection lost');
            OfflineManager.updateUI(false);
        });

        // Try syncing on load
        OfflineManager.processQueue();

        // Periodic check just in case events miss
        setInterval(OfflineManager.processQueue, 30000);
    }
};
