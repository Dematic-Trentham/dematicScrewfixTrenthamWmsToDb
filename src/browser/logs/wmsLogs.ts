//Service for Dematic Dashboard Screwfix trentham to extract data from matflow wms system log files
//log functions
//Created by: JWL
//Date: 2023-12-30
//Last modified: 2024/11/04 03:14:04
//Version: 0.0.1

//imports
import * as puppeteer from "puppeteer";

async function getLogFiles(
	browserInstance: puppeteer.Browser,
	mainHost: string,
	dateTime: string,
	logArray: string[],
	query: string
): Promise<{
	status: string;
	error?: string;
	data?: { i: number; time: string; log: string; message: string }[];
}> {
	//open the log files page
	const page = await browserInstance.newPage();
	await page.goto(`${mainHost}/cgi-bin/web_om_td1.exe#scr=logsquery`);

	try {
		//if no logs are selected then return
		if (logArray.length == 0) {
			return { status: "ERROR", error: "No logs selected" };
		}

		//wait for the page to load
		await page.waitForSelector("#log00");

		//build the array of checkboxes to check (On Page JS)
		const logLabels = await page.evaluate(() => {
			let data = [];
			let table = document.getElementById("LogQueryFiles");

			//@ts-ignore
			for (var i = 1; i < table.rows.length; i++) {
				//@ts-ignore
				let objCells = table.rows.item(i).cells;

				let values = [];
				for (var j = 0; j < objCells.length; j++) {
					let line = objCells.item(j).innerHTML.split("\n")[4];
					data.push(line);
				}
			}

			return data;
		});

		//Make list of name vs log number for checkbox labels
		var logList = [];
		for (var i = 0; i < logLabels.length; i++) {
			if (logLabels[i] == null) continue;
			if (logLabels[i].includes("label") == false) continue;

			var log = logLabels[i].split(`for="`)[1].split(`">`)[0];
			var name = logLabels[i].split(`">`)[1].split(`</`)[0];
			logList[name] = log;
		}

		//loop through the logs and uncheck
		//for each log in the object uncheck the box if it exists in the list of logs to be checked
		for (let i in logList) {
			try {
				//console.log("unchecking " + logList[i]);

				//@ts-ignore (on page js)
				await page.evaluate(
					(val) => (document.querySelector(val).checked = false),
					"#" + logList[i]
				);
			} catch (e) {
				console.log(e);
			}
		}

		//for each log in the array check the box if it exists in the list of logs to be checked
		for (let i = 0; i < logArray.length; i++) {
			try {
				//@ts-ignore (on page js)
				await page.evaluate(
					(val) => (document.querySelector(val).checked = true),
					"#" + logList[logArray[i]]
				);
			} catch (e) {}
		}

		if (dateTime == null) {
			//Get Todays Date
			let date = new Date();

			//Add today to query (On Page JS)
			await page.evaluate(
				//@ts-ignore
				(val) => (document.querySelector("#Qry1").value = val),
				date.getDate() +
					"-" +
					date.toLocaleString("en-us", { month: "short" }) +
					"-" +
					date.getFullYear()
			);
		} else {
			//Add today to query
			//@ts-ignore
			await page.evaluate(
				(val) => (document.querySelector("#Qry1").value = val),
				dateTime
			);
		}

		//add the query to the search box
		//@ts-ignore
		await page.evaluate(
			(val) => (document.querySelector("#Qry2").value = val),
			query
		);

		//click the search button
		await page.click(
			`#LogQueryFiles > tbody > tr:nth-child(16) > td > div.button_bar_holder.right.button_bar_gap > input`
		);

		//wait for the page to load
		await page.waitForSelector("#listtbl1", { timeout: 30000 });

		//wait a little bit longer
		await sleep(1000);

		//get the log file from the page (On Page JS)
		let rawData = await page.evaluate(() => {
			let data = [];
			let table = document.getElementById("listtbl1");

			//@ts-ignore
			for (var i = 1; i < table.rows.length; i++) {
				//@ts-ignore
				let objCells = table.rows.item(i).cells;

				let d = {
					i,
					time: objCells.item(0).innerText,
					log: objCells.item(1).innerText,
					message: objCells.item(2).innerText,
				};
				data.push(d);
			}

			return data;
		});

		return { status: "OK", data: rawData };
	} catch (error: any) {
		if (
			error.message ==
			"TimeoutError: waiting for selector `#listtbl1 > tbody > tr:nth-child(2) > td:nth-child(1)` failed: timeout 30000ms exceeded"
		) {
			return { status: "ERROR", error: "No Data Found" };
		} else return { status: "ERROR", error: error.message };
	} finally {
		await page.close();
	}
}

//enum for the date type
enum DateType {
	startingAtDate1 = "starting at date 1",
	betweenDate1AndDate2 = "between date 1 and date 2",
	endingAtDate1 = "ending at date 1",
	last15Minutes = "last 15 minutes",
	last30Minutes = "last 30 minutes",
	last1Hour = "last 1 hour",
	lastAHour = "last actual hour",
	today = "today",
	yesterday = "yesterday",
	last7Days = "last 7 days",
}

//function to return the correct date string
function getDateString(type: DateType, date1?: Date, date2?: Date) {
	let date = "";
	switch (type) {
		case DateType.startingAtDate1: //starting at date 1
			if (date1 == null) return "ERROR: No date provided";
			date = formatDate(date1, "DD-MMM-YYYY hh:mm:ss") + " ..";
			return date;

		case DateType.betweenDate1AndDate2: //between date 1 and date 2
			if (date1 == null || date2 == null) return "ERROR: No date provided";

			date =
				formatDate(date1, "DD-MMM-YYYY hh:mm:ss") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.endingAtDate1: //ending at date 1
			if (date1 == null) return "ERROR: No date provided";

			date = ".. " + formatDate(date1, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.last15Minutes: //last 15 minutes
			(date1 = new Date(new Date().getTime() - 15 * 60000)),
				(date2 = new Date());

			date =
				formatDate(date1, "DD-MMM-YYYY hh:mm:ss") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.last30Minutes: //last 30 minutes
			(date1 = new Date(new Date().getTime() - 30 * 60000)),
				(date2 = new Date());

			date =
				formatDate(date1, "DD-MMM-YYYY hh:mm:ss") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.last1Hour: //last 1 hour
			date2 = getCurrentBSTDate();
			date1 = getCurrentBSTDate();

			date1.setHours(date1.getHours() - 1);

			date =
				formatDate(date1, "DD-MMM-YYYY hh:mm:ss") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.lastAHour: //last actual hour e.g. 12:00 - 13:00 not 12:01 - 13:01
			date2 = getCurrentBSTDate();
			date1 = getCurrentBSTDate();

			date1.setHours(date1.getHours() - 1);
			date1.setMinutes(0);
			date1.setSeconds(0);

			date2.setMinutes(0);
			date2.setSeconds(0);

			date =
				formatDate(date1, "DD-MMM-YYYY hh:mm:ss") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY hh:mm:ss");
			return date;

		case DateType.today: //today
			(date1 = new Date()), (date = formatDate(date1, "DD-MMM-YYYY"));
			return date;

		case DateType.yesterday: //yesterday
			(date1 = new Date(new Date().getTime() - 24 * 60 * 60000)),
				(date = formatDate(date1, "DD-MMM-YYYY"));
			return date;

		case DateType.last7Days: //last 7 days
			(date1 = new Date(new Date().getTime() - 7 * 24 * 60 * 60000)),
				(date2 = new Date());

			date =
				formatDate(date1, "DD-MMM-YYYY") +
				" .. " +
				formatDate(date2, "DD-MMM-YYYY");
			return date;

		default:
			return "ERROR: No Date Type Provided";
	}
}

//function to format the date
function formatDate(date: Date, format: string) {
	let formatted = format;
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	formatted = formatted.replace("YYYY", date.getFullYear().toString());
	formatted = formatted.replace("MMM", months[date.getMonth()]);
	formatted = formatted.replace(
		"MM",
		(date.getMonth() + 1).toString().padStart(2, "0")
	);
	formatted = formatted.replace(
		"DD",
		date.getDate().toString().padStart(2, "0")
	);
	formatted = formatted.replace(
		"hh",
		date.getHours().toString().padStart(2, "0")
	);
	formatted = formatted.replace(
		"mm",
		date.getMinutes().toString().padStart(2, "0")
	);
	formatted = formatted.replace(
		"ss",
		date.getSeconds().toString().padStart(2, "0")
	);

	return formatted;
}

function getCurrentBSTDate(): Date {
	// Create a new Date object representing the current date and time in UTC format
	const currentDate = new Date();

	// Get the year, month, day, hour, minute, second, and millisecond components of the current date and time
	const year = currentDate.getUTCFullYear();
	const month = currentDate.getUTCMonth();
	const day = currentDate.getUTCDate();
	const hour = currentDate.getUTCHours();
	const minute = currentDate.getUTCMinutes();
	const second = currentDate.getUTCSeconds();
	const milliseconds = currentDate.getUTCMilliseconds();

	// Create a new Date object that represents the same date and time, but in the local time zone of the Node.js process
	const currentBSTDate = new Date(
		Date.UTC(year, month, day, hour, minute, second, milliseconds)
	);

	// Return the BST date object
	return currentBSTDate;
}

//function to sleep
function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function processDCI(
	data:
		| { i: number; time: string; log: string; message: string }[]
		| undefined
		| null,
	query: string
) {
	if (data == undefined) return { status: "ERROR", error: "No data provided" };

	let processedData: {
		time: string;
		type: string;
		sender: string;
		receiver: string;
		returnCode: string;
		message: string;
		data: {
			sourceLocation: string;
			currentLocation: string;
			destinationLocation: string;
			tuIdentifier: string;
			tuType: string;
			tuLength: string;
			tuWidth: string;
			tuHeight: string;
			tuWeight: string;
		};
	}[] = [];

	//first row is the date row
	processedData.push({
		time: data[0].time,
		type: "DATE",
		sender: "",
		receiver: "",
		returnCode: "",
		message: data[0].time,
		data: {
			sourceLocation: "",
			currentLocation: "",
			destinationLocation: "",
			tuIdentifier: "",
			tuType: "",
			tuLength: "",
			tuWidth: "",
			tuHeight: "",
			tuWeight: "",
		},
	});

	//loop through the data
	for (let i = 1; i < data.length; i++) {
		//if the message does not contain the query then add it to the processed data wuthout any processing
		if (data[i].message.includes(query) == false) {
			//processedData.push({ time: data[i].time, type: "DATE", sender: "", receiver: "", returnCode: "", message: data[i].time ,data:{ sourceLocation:"", currentLocation:"", destinationLocation:"", tuIdentifier:"", tuType:"", tuLength:"", tuWidth:"", tuHeight:"", tuWeight:"" }});

			continue;
		}

		//console.log(data[i].message);

		let message = data[i].message.split("/R")[1];

		//remove the last 2 characters from the message "end of line" ##
		message = message.slice(0, -2);

		//first 4 characters are the type
		let type = message.slice(0, 4);
		message = message.slice(4);

		//Next 4 characters are the sender
		let sender = message.slice(0, 4);
		message = message.slice(4);

		//Next 4 characters are the receiver
		let receiver = message.slice(0, 4);
		message = message.slice(4);

		//Next 4 characters are the cyle number
		let cycleNumber = message.slice(0, 4);
		message = message.slice(4);

		//Next 2 characters are the return code
		let returnCode = message.slice(0, 2);
		message = message.slice(2);

		//Next 2 characters are the block length
		let blockLength = parseInt(message.slice(0, 2));
		message = message.slice(2);

		//Next 2 characters are the block type
		let blockType = message.slice(0, 2);
		message = message.slice(2);

		//Next 4 characters are the length of the message
		let messageLength = message.slice(0, 4);
		message = message.slice(4);

		//console.log({ time: data[i].time, type, sender, receiver, returnCode, blockLength, blockType, message })

		//loop through the message
		for (let j = 0; j < message.length; j += 114) {
			//add the block to the array
			let messageLocal = message.slice(j, j + 114);

			//does the message contain the query string
			if (messageLocal.includes(query) == false) continue;

			//first 14 characters are the source location
			let sourceLocation = messageLocal.slice(0, 14);
			messageLocal = messageLocal.slice(14);

			//Next 14 characters are the current location
			let currentLocation = messageLocal.slice(0, 14);
			messageLocal = messageLocal.slice(14);

			//Next 14 characters are the destination location
			let destinationLocation = messageLocal.slice(0, 14);
			messageLocal = messageLocal.slice(14);

			//Next 22 characters are the TU identifier
			let tuIdentifier = messageLocal.slice(0, 22);
			messageLocal = messageLocal.slice(22);

			//remove any .'s at the end of the tuIdentifier
			tuIdentifier = tuIdentifier.replace(/\./g, "");

			//Next 4 characters are the TU type
			let tuType = messageLocal.slice(0, 4);
			messageLocal = messageLocal.slice(4);

			//Next 4 characters are the TU length
			let tuLength = messageLocal.slice(0, 4);
			messageLocal = messageLocal.slice(4);

			//Next 4 characters are the TU width
			let tuWidth = messageLocal.slice(0, 4);
			messageLocal = messageLocal.slice(4);

			//Next 4 characters are the TU height
			let tuHeight = messageLocal.slice(0, 4);
			messageLocal = messageLocal.slice(4);

			//Next 8 characters are the TU weight
			let tuWeight = messageLocal.slice(0, 8);
			messageLocal = messageLocal.slice(8);

			//Next 2 characters are the event code
			let eventCode = messageLocal.slice(0, 2);
			messageLocal = messageLocal.slice(2);

			processedData.push({
				time: data[i].time,
				type,
				sender,
				receiver,
				returnCode,
				message: messageLocal,
				data: {
					sourceLocation,
					currentLocation,
					destinationLocation,
					tuIdentifier,
					tuType,
					tuLength,
					tuWidth,
					tuHeight,
					tuWeight,
				},
			});
		}
	}

	return { status: "OK", data: processedData };
}

//export the functions
export default {
	getLogFiles,
	getDateString,
	formatDate,
	enum: { DateType },
	processDCI,
};
