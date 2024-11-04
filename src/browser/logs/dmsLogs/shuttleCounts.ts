//Service for Dematic Dashboard Screwfix trentham
//log functions
//Created by: JWL
//Date: 2023-12-30
//Last modified: 2024/11/04 04:12:52
//Version: 0.0.1

//imports
import * as puppeteer from "puppeteer";
import db from "../../../db/db.js";

import wmsLogs, { processDCI } from "../wmsLogs.js";
import browser from "../../browser.js";
import { getParameterFromDB } from "../../../misc/getParameterFromDB.js";
import { parse } from "path";

async function getShuttleCounts(
	browserInstance: puppeteer.Browser,
	mainHost: string
) {
	const amountOfAisles = parseInt(
		await getParameterFromDB("dmsAmountOfAisles")
	);

	for (let i = 1; i < amountOfAisles + 1; i++) {
		console.log(
			`Getting shuttle counts for aisle ${i.toString()} of ${amountOfAisles}`
		);

		await getShuttleCountsAisle(browserInstance, mainHost, i.toString());
	}
}

async function getShuttleCountsAisle(
	browserInstance: puppeteer.Browser,
	mainHost: string,
	aisle: string
) {
	//get timestring
	const timestring = await wmsLogs.getDateString(
		wmsLogs.enum.DateType.lastAHour
	);

	//  Get the shuttle counts
	const shuttleCounts = await wmsLogs.getLogFiles(
		browserInstance,
		mainHost,
		timestring,
		[`Multi Shuttle PLC ${aisle} Communications log file`],
		"RTUNO"
	);

	//process the shuttle proccess DCI
	const shuttleCountsProccessed = await processDCI(shuttleCounts.data, "");

	//loop through the shuttle counts to get picks and drops
	let picksForLevels = [];
	let dropsForLevels = [];
	let iatsForLevels = [];

	if (shuttleCountsProccessed.data == null) {
		console.log("No shuttle counts found");
		return;
	}

	for (let i = 0; i < shuttleCountsProccessed.data.length; i++) {
		const shuttleCount = shuttleCountsProccessed.data[i];

		//if the current location is a shuttle then we have a missiom
		if (
			shuttleCount.data.currentLocation.includes("LV") &&
			shuttleCount.data.currentLocation.includes("SH01")
		) {
			const level = parseInt(
				shuttleCount.data.currentLocation.substring(8, 10)
			);

			if (shuttleCount.data.sourceLocation.includes("RI")) {
				//console.log("PICK");

				if (picksForLevels[level] == null) {
					picksForLevels[level] = 1;
				} else {
					picksForLevels[level]++;
				}
			} else if (shuttleCount.data.destinationLocation.includes("RO")) {
				//console.log("DROP");

				if (dropsForLevels[level] == null) {
					dropsForLevels[level] = 1;
				} else {
					dropsForLevels[level]++;
				}
			} else {
				//console.log("IAT");

				if (iatsForLevels[level] == null) {
					iatsForLevels[level] = 1;
				} else {
					iatsForLevels[level]++;
				}
			}
		}
	}

	//console.log(JSON.stringify(picksForLevels, null, 2));
	//console.log(JSON.stringify(dropsForLevels, null, 2));
	//console.log(JSON.stringify(iatsForLevels, null, 2));

	const amountOfLevels = parseInt(
		await getParameterFromDB("dmsAmountOfLevels")
	);
	//for each level
	for (let i = 1; i < amountOfLevels + 1; i++) {
		//get the pick count
		let pickCount = picksForLevels[i] == null ? 0 : picksForLevels[i];
		//get the drop count
		let dropCount = dropsForLevels[i] == null ? 0 : dropsForLevels[i];
		//get the iat count
		let iatCount = iatsForLevels[i] == null ? 0 : iatsForLevels[i];

		let shuttleIDResult = await db.dmsShuttleLocations.findFirst({
			where: {
				currentLocation: {
					contains: `${aisle}LV${i.toString().padStart(2, "0")}SH01`,
				},
			},
		});

		let shuttleID = shuttleIDResult == null ? "" : shuttleIDResult.shuttleID;

		//timestamp is the current time rounded to the down to the nearest hour and then subtracted by 1 hour
		let timeStamp = new Date();
		timeStamp.setMinutes(0);
		timeStamp.setSeconds(0);
		timeStamp.setMilliseconds(0);
		timeStamp.setHours(timeStamp.getHours() - 1);

		//console.log(`Level ${i} - Picks: ${pickCount} Drops: ${dropCount} IATs: ${iatCount} ShuttleID: ${shuttleID}`);
		await db.dmsShuttleMissions.create({
			data: {
				timeStamp: timeStamp,
				timeRange: "1 Hour",
				aisle: parseInt(aisle),
				level: i,
				totalPicks: pickCount,
				totalDrops: dropCount,
				totalIATs: iatCount,
				shuttleID: shuttleID,
			},
		});

		console.log(
			`Level ${i} - Picks: ${pickCount} Drops: ${dropCount} IATs: ${iatCount} ShuttleID: ${shuttleID} inserted`
		);
	}
}

export default { getShuttleCounts };
//tests
