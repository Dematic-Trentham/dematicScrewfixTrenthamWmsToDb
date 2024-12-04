import db from "./db.js";

//update or insert error into the db
export async function updateErrorInDB(system: string, error: string) {
	const result = await db.dashboardSystemErrors.findFirst({
		where: {
			system: system,
		},
	});
	if (result) {
		await db.dashboardSystemErrors.update({
			where: {
				system: system,
			},
			data: {
				error: error,
			},
		});
	} else {
		await db.dashboardSystemErrors.create({
			data: {
				system: system,
				error: error,
			},
		});
	}
}
