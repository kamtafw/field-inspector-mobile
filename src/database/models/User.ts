import { Model } from "@nozbe/watermelondb"
import { field, text } from "@nozbe/watermelondb/decorators"

export default class User extends Model {
	static table = "users"

	@text("email") email!: string
	@text("first_name") firstName!: string
	@text("last_name") lastName!: string
	@text("role") role!: "inspector" | "manager"
	@field("login_ts") loginTs!: number
}
