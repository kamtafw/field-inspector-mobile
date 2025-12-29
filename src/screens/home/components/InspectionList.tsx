import { FlatList } from "react-native"
import InspectionCard from "./InspectionCard"
import Inspection from "@/src/database/models/Inspection"
import { withObservables } from "@nozbe/watermelondb/react"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

/*
TODO: guard withObservables null states - assume:
- DB returns empty array
- DB not ready
** component should survive both
*/

function InspectionList({ inspections }: { inspections: Inspection[] }) {
	return (
		<FlatList
			data={inspections}
			contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <InspectionCard inspection={item} />}
		/>
	)
}

const enhance = withObservables([], () => ({
	inspections: InspectionRepository.collection.query(),
}))

const EnhancedInspectionList = enhance(InspectionList)
export default EnhancedInspectionList
