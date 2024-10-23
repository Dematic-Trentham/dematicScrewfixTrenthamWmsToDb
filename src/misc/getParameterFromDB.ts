import db from "../db/db.js";

export async function getParameterFromDB(parameter: string) {
	const result = await db.dashboardSystemParameters.findFirst({
		where: {
			parameter: parameter,
		},
	});

	//if no result raise an error
	if (!result) {
		throw new Error(`Parameter ${parameter} not found in the database`);
	}

	return result?.value;
}
