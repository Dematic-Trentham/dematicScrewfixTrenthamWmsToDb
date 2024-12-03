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

export async function isParameterTrue(parameter: string) {
	const result = await getParameterFromDB(parameter);

	return result === "true";
}

export async function isParameterFalse(parameter: string) {
	const result = await getParameterFromDB(parameter);

	return result === "false";
}

export async function setParameterInDB(parameter: string, value: string) {
	const result = await db.dashboardSystemParameters.findFirst({
		where: {
			parameter: parameter,
		},
	});

	if (!result) {
		await db.dashboardSystemParameters.create({
			data: {
				parameter: parameter,
				value: value,
			},
		});
		return;
	}

	await db.dashboardSystemParameters.update({
		where: {
			parameter: parameter,
		},
		data: {
			value: value,
		},
	});
}
