import { Q } from "@nozbe/watermelondb"
import database from ".."
import User from "../models/User"

export interface CreateUserPayload {
	id: string
	email: string
	first_name: string
	last_name: string
	role: "inspector" | "manager"
}

class UserRepository {
	collection = database.get<User>("users")

	/** Get user by ID */
	async getById(id: string): Promise<User | null> {
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	/** Get user by remote ID (server UUID) */
	async getByRemoteId(remoteId: string): Promise<User | null> {
		const records = await this.collection.query(Q.where("remote_id", remoteId)).fetch()
		return records.at(0) || null
	}

	/** Create user record on login */
	async create(data: CreateUserPayload): Promise<User> {
		// check if user already exists
		const existing = await this.getById(data.id)

		const user = await database.write(async () => {
			if (existing) {
				// update existing user
				console.log(`📝 Updating existing user ${data.id}`)
				return await existing.update((record) => {
					record.email = data.email
					record.firstName = data.first_name
					record.lastName = data.last_name
					record.role = data.role
					record.loginTs = Date.now()
				})
			} else {
				// create new user
				console.log(`✨ Creating new user ${data.id}`)
				return await this.collection.create((record) => {
					record._raw.id = data.id
					record.email = data.email
					record.firstName = data.first_name
					record.lastName = data.last_name
					record.role = data.role
					record.loginTs = Date.now()
				})
			}
		})

		return user
	}

	/** Delete user record on logout */
	async delete(id: string): Promise<void> {
		const user = await this.getById(id)
		if (!user) return

		await database.write(async () => {
			await user.markAsDeleted()
		})
	}
}

export default new UserRepository()
