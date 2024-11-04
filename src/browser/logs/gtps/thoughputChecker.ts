//Service for Dematic Dashboard Screwfix trentham to extract data for gtp thoughput for DMS GTPS from WMS system log files
//log functions
//Created by: JWL
//Date: 2023-12-30
//Last modified: 2024/10/25 07:15:52
//Version: 0.0.1

//imports
import * as puppeteer from "puppeteer";
import db from "../../../db/db.js";

import wmsLogs from "../wmsLogs.js";

//get the throughput of the GTPS
async function getGTPSThroughput(
	browserInstance: puppeteer.Browser,
	mainHost: string
) {
	//get timestring
	const timestring = await wmsLogs.getDateString(
		wmsLogs.enum.DateType.lastAHour
	);
	console.log(timestring);

	//get the log files for PLC35 ("Case Conveyor DCI Communications log file")
	const stockInRawGTPLower1 = await wmsLogs.getLogFiles(
		browserInstance,
		mainHost,
		timestring,
		["Multi Shuttle PLC 1 Communications log file"],
		"21699274"
	);

	console.log(stockInRawGTPLower1);

	//process the DCI as some messages contain multiple journeys
	const proccessedStockInRawGTPLower1 = wmsLogs.processDCI(
		stockInRawGTPLower1.data,
		"21699274"
	);

	console.log(JSON.stringify(proccessedStockInRawGTPLower1, null, 2));
}

export default { getGTPSThroughput };
