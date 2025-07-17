import { MongoClient, MongoClientOptions } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

// check the MongoDB URI
if (!MONGODB_URI) {
	throw new Error("Define the MONGODB_URI environmental variable");
}

let cachedClient: any = null;
let cachedDb: any = null;

export async function connectToDatabase(dbName: string) {
	// check the cached.
	if (cachedClient && cachedDb) {
		// load from cache
		return {
			client: cachedClient,
			db: cachedDb,
		};
	}

	// Connect to cluster
	const client = new MongoClient(MONGODB_URI!);
	await client.connect();
	const db = client.db(dbName);

	// set cache
	cachedClient = client;
	cachedDb = db;

	return {
		client: cachedClient,
		db: cachedDb,
	};
}
