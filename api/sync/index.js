// api/sync/index.js - Cloud Sync API for IronLog
const { CosmosClient } = require('@azure/cosmos');

let cosmosClient = null;
let database = null;
let workoutsContainer = null;

function getCosmosContainers() {
    const connStr = process.env.COSMOS_CONNECTION_STRING;
    if (!connStr) {
        throw new Error('COSMOS_CONNECTION_STRING environment variable is not configured');
    }

    if (!cosmosClient) {
        cosmosClient = new CosmosClient(connStr);
        database = cosmosClient.database('ironlog-db');
        workoutsContainer = database.container('workouts');
    }

    return { workoutsContainer };
}

function getClientPrincipal(req) {
    const headers = req.headers || {};
    const header = headers['x-ms-client-principal'] || headers['X-MS-CLIENT-PRINCIPAL'];
    if (!header) return null;

    try {
        const encoded = Buffer.from(header, 'base64');
        const decoded = encoded.toString('utf8');
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

module.exports = async function (context, req) {
    context.log('IronLog Sync API invoked:', req.method);

    // 1. Authenticate user from SWA headers
    const principal = getClientPrincipal(req);
    if (!principal || !principal.userId) {
        context.res = {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Unauthorized',
                message: 'Please sign in with your Microsoft Account at /.auth/login/aad to sync your workouts.'
            }
        };
        return;
    }

    const userId = principal.userId;
    const userEmail = principal.userDetails || 'anonymous';

    try {
        const { workoutsContainer } = getCosmosContainers();

        if (req.method === 'POST') {
            const body = req.body || {};
            const workouts = Array.isArray(body.workouts) ? body.workouts : [];

            context.log(`Syncing ${workouts.length} workouts for user: ${userEmail} (${userId})`);

            let syncedCount = 0;
            for (const workout of workouts) {
                if (!workout || !workout.id) continue;

                // Ensure partition key and user ownership
                workout.id = String(workout.id);
                workout.userId = userId;
                workout.userEmail = userEmail;
                workout.isSynced = true;
                workout.syncedAt = new Date().toISOString();

                await workoutsContainer.items.upsert(workout);
                syncedCount++;
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    syncedCount,
                    userId,
                    userEmail
                }
            };
        } else if (req.method === 'GET') {
            // Fetch cloud workouts for this user (e.g. restoring on a new device)
            context.log(`Fetching cloud workouts for user: ${userEmail} (${userId})`);

            const querySpec = {
                query: 'SELECT * FROM c WHERE c.userId = @userId',
                parameters: [{ name: '@userId', value: userId }]
            };

            const { resources: items } = await workoutsContainer.items.query(querySpec, {
                partitionKey: userId
            }).fetchAll();

            const workouts = (items || []).sort((a, b) => new Date(b.date || b.startTime) - new Date(a.date || a.startTime));

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    workouts,
                    count: workouts.length,
                    userId,
                    userEmail
                }
            };
        }
    } catch (err) {
        context.log.error('Sync error:', err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'SyncFailed',
                message: err.message
            }
        };
    }
};
