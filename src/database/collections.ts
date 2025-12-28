import database from "."
import Inspection from "./models/Inspection"

export const inspectionsCollection = database.get<Inspection>("inspections")

export const usersCollection = database.get("users")
