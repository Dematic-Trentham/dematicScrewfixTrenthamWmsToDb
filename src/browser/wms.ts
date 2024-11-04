//Service for Dematic Dashboard Screwfix trentham to collect data from WMS and push to DB
//WMS functions
//Created by: JWL
//Date: 2022-12-30
//Last modified: 2024/11/04 03:43:12
//Version: 0.0.1

import * as puppeteer from "puppeteer";

import browser from "../browser/browser.js";
//import wmsLogs from "./logs/wmsLogs.js";
//import exceptions from "./exceptions/index.js";
//import tours from "./tours/index.js";
//import dms from "./dms/index.js";

import shuttleCounts from "./logs/dms/shuttleCounts.js";

import db from "../db/db.js";

import { getParameterFromDB } from "../misc/getParameterFromDB.js";

//go to the WMS and login using the username and password provided, then return the host IP

export async function loginToWMS(
	browserInstance: puppeteer.Browser
): Promise<string> {
	//open new tab
	var page = await browser.openNewTab(browserInstance);

	//Make object to return
	var wmsUserPassObj = {
		username: await getParameterFromDB(
			"dematic_dashboard_WMS_Credentials_User"
		),
		password: await getParameterFromDB(
			"dematic_dashboard_WMS_Credentials_Pass"
		),
	};

	//if the username or password was not found
	if (wmsUserPassObj.username == "" || wmsUserPassObj.password == "") {
		return "failed";
	}

	//Goto WMS
	await page.goto("http://10.4.26.8");

	//Goto login page
	await page.click(`body > ul > li:nth-child(1) > a`);

	//Login
	await page.waitForSelector("#uid");

	// @ts-ignore
	await page.evaluate(
		// @ts-ignore
		(val) => (document.querySelector("#uid").value = val),

		wmsUserPassObj.username
	);
	// @ts-ignore
	await page.evaluate(
		(val) => {
			const element = document.querySelector("#pwd");
			if (element) {
				(element as HTMLInputElement).value = val;
			}
		},

		wmsUserPassObj.password
	);

	//click login button
	await page.click(
		`#LoginForm > table > tbody > tr:nth-child(2) > td > div:nth-child(1) > div > input`
	);

	//wait for page to load
	try {
		await page.waitForSelector("#tools > div:nth-child(11) > a", {
			timeout: 5000,
		});
	} catch (e) {}

	//get title of current page
	// @ts-ignore
	const title = await page.evaluate(
		// @ts-ignore
		() => document.querySelector("title").innerText
	);

	if (title.includes("Home")) {
		console.log("WMS Login Successful");
	} else if (title == "Unknown User") {
		console.log("WMS Login Failed due to unknown user");
	}

	//get the host IP for  primary WMS or secondary WMS
	var hostIP = await page.evaluate(() => document.location.hostname);

	//add http:// to the host IP
	hostIP = "http://" + hostIP;

	//close the page
	//await page.close();

	//return the host IP
	return hostIP;
}

//change password for WMS
export async function changePassword(
	browser: puppeteer.Browser,
	host: string,
	password: string,
	newPassword: string
) {
	console.log("Changing WMS password");

	//create a new page
	const page = await browser.newPage();

	//Goto WMS
	await page.goto(host + "/cgi-bin/web_om_td1.exe#scr=pwdchg");

	//wait for page to load
	await page.waitForSelector("#pwd");

	//fill in the form
	// @ts-ignore
	await page.evaluate(
		// @ts-ignore
		(val) => (document.querySelector("#pwd").value = val),
		password
	);
	// @ts-ignore
	await page.evaluate(
		// @ts-ignore
		(val) => (document.querySelector("#newpwd").value = val),
		newPassword
	);
	// @ts-ignore
	await page.evaluate(
		// @ts-ignore
		(val) => (document.querySelector("#verifypwd").value = val),
		newPassword
	);

	//click login button
	await page.click(`#ViewTable > tbody > tr:nth-child(4) > td > div > input`);

	//wait for div banner to appear to confirm password change dont wait more than 5 seconds for the div banner to appear if it doesn't appear then the password change failed]
	let result = await page
		.waitForSelector(
			"#warning_message_green_0 > div.warningmessage.text-center",
			{ visible: true, timeout: 500 }
		)
		.then(() => true)
		.catch(() => false);

	//if the div banner appears, then the password has been changed
	if (result) {
		console.log("Password changed successfully");

		db.dashboardSystemParameters.update({
			where: {
				parameter: "dematic_dashboard_WMS_Credentials_Pass",
			},
			data: {
				value: newPassword,
			},
		});
	} else {
		console.log("Password change failed ");

		try {
			//get the error message
			// @ts-ignore
			let errorMessage = await (
				await page.evaluate(
					() =>
						// @ts-ignore
						document.querySelector(
							"#warning_message_red_0 > div.warningmessage.text-center"
						) as HTMLElement
				)
			).innerText;

			console.log(errorMessage);
		} catch (e) {
			console.log("Error message not found");
		}
	}

	//close the page
	await page.close();
}

//check if the password is should be changed
export async function checkPassword(browserInstance: puppeteer.Browser) {
	//check mysql db to see when the WMS password was last changed
	const result = await db.dashboardSystemParameters.findMany({
		where: {
			parameter: "dematic_dashboard_WMS_Credentials_Pass",
		},
	});

	//check if the result is empty
	if (result.length == 0) {
		console.log(
			"Error: No WMS Password found in DB - Please add to the parameters table e.g. dematic_dashboard_WMS_Credentials_Pass"
		);
		return "";
	}

	if (result[0].value == "") {
		console.log(
			"Error: WMS Password is empty in DB - Please add to the parameters table e.g. dematic_dashboard_WMS_Credentials_Pass"
		);
		return "";
	}

	if (result[0].lastModified == null) {
		console.log(
			"Error: WMS Password last modified date is null in DB - Please add to the parameters table e.g. dematic_dashboard_WMS_Credentials_Pass"
		);
		return "";
	}

	//get the last modified date
	var lastModified = result[0].lastModified;

	//get the current date
	var currentDate = new Date();

	//get the difference in hours
	var diffHours = hoursBetweenToDates(lastModified, currentDate);

	//if the password has been changed in the last 5 days
	if (diffHours < 120) {
		//console.log("WMS Password has been changed in the last 5 days - No need to change again");
		return;
	}

	//Make object to return
	var wmsUserPassObj = {
		username: await getParameterFromDB(
			"dematic_dashboard_WMS_Credentials_User"
		),
		password: await getParameterFromDB(
			"dematic_dashboard_WMS_Credentials_Pass"
		),
	};

	//if the username or password was not found
	if (wmsUserPassObj.username == "" || wmsUserPassObj.password == "") {
		return "failed";
	}

	//open new tab
	var page = await browser.openNewTab(browserInstance);

	const host = await loginToWMS(browserInstance);

	//if old password is "DematicA" then change to "DematicB", else if old password is "DematicB" then change to "DematicC" else if old password is "DematicC" then change to "DematicD" then repeat
	var newPass = "";

	if (wmsUserPassObj.password == "Dematic1") {
		newPass = "Dematic2";
	} else if (wmsUserPassObj.password == "Dematic2") {
		newPass = "Dematic3";
	} else if (wmsUserPassObj.password == "Dematic3") {
		newPass = "Dematic4";
	} else {
		newPass = "Dematic1";
	}

	//change wms password
	await changePassword(browserInstance, host, wmsUserPassObj.password, newPass);
}

//update order start status
export async function updateOrderStartStatus(
	pageTotes: puppeteer.Page,
	pageCarton: puppeteer.Page
) {
	console.log("Updating Order Start Status");
	//if pages are not loaded then return
	if (pageTotes == null || pageCarton == null) {
		console.log("Pages not loaded");
		return;
	}

	//get the orderstart fields from db
	//var sql = "SELECT * FROM parameters WHERE parameter LIKE 'dematic_dashboard_OrderStart_parameters_%'";

	//run the query
	//var SQLresult = await mysql.query(sql, []);

	const SQLresult = await db.dashboardSystemParameters.findMany({
		where: {
			parameter: {
				startsWith: "dematic_dashboard_OrderStart_parameters_",
			},
		},
	});

	//if the result is empty
	if (SQLresult.length == 0) {
		console.log(
			"Error: No Order Start Status found in DB - Please add to the parameters table e.g. dematic_dashboard_OrderStart_parameters_toteText1"
		);
		return;
	}

	let fields = {
		toteTableSelector: "",
		cartonTableSelector: "",
		carton1Field: "",
		carton2Field: "",
		carton3Field: "",
		carton4Field: "",
		carton5Field: "",
		Carton1: "",
		Carton2: "",
		Carton3: "",
		Carton4: "",
		Carton5: "",
	};

	//loop through the results
	for (let i = 0; i < SQLresult.length; i++) {
		//get the parameter name
		let parameter = SQLresult[i].parameter;

		//get the parameter value
		let value = SQLresult[i].value;

		//get the parameter name without the prefix
		let parameterName = parameter.replace(
			"dematic_dashboard_OrderStart_parameters_",
			""
		);

		//set the value in the fields object
		//@ts-ignore
		fields[parameterName] = value;
	}

	//lets work out the field name for totes
	let mainTableSelector = fields.toteTableSelector;

	let mainTable = await pageTotes.evaluate(
		(mainTableSelector) => document.getElementById(mainTableSelector),
		mainTableSelector
	);

	//if the main table is not found then throw an error
	if (mainTable == null) {
		console.error("Order Start Status Update - Main table not found");

		throw new Error(
			"Order Start Status Update - Main table not found, please check the selector for the main table for totes"
		);
		return;
	}

	if (mainTableSelector == "") {
		console.error("Order Start Status Update - Main table selector not found");
		return;
	}

	//get column 2 row 2 of the main table for tote1
	let toteText1 = await pageTotes.evaluate(
		//@ts-ignore
		(mainTableSelector) => {
			if (
				(document.getElementById(mainTableSelector) as HTMLTableElement)
					?.rows[1].cells[1] == null
			) {
				return "";
			}

			return (document.getElementById(mainTableSelector) as HTMLTableElement)
				?.rows[1].cells[1].innerText;
		},
		mainTableSelector
	);

	//get column 2 row 3  of the main table for tote2
	let toteText2 = await pageTotes.evaluate(
		//@ts-ignore
		(mainTableSelector) => {
			if (
				(document.getElementById(mainTableSelector) as HTMLTableElement)
					?.rows[2].cells[1] == null
			) {
				return "";
			}

			return (document.getElementById(mainTableSelector) as HTMLTableElement)
				?.rows[2].cells[1].innerText;
		},
		mainTableSelector
	);

	//read totes
	//@ts-ignore
	//let toteText1 = await pageTotes.evaluate((fields) => parseInt(document.querySelector(fields.Tote1).textContent), fields);
	//@ts-ignore
	//let toteText2 = await pageTotes.evaluate((fields) => parseInt(document.querySelector(fields.Tote2).textContent), fields);

	//lets work out the field name for cartons
	//console.log(fields.cartonTableSelector);
	//get the whole table for cartons
	const logLabels = await pageCarton.evaluate((fields) => {
		let data = [];
		let table = document.getElementById(fields.cartonTableSelector);

		//debug
		//make the table red
		//@ts-ignore
		table.style.backgroundColor = "red";

		//@ts-ignore
		for (var i = 1; i < table.rows.length; i++) {
			//@ts-ignore
			let objCells = table.rows.item(i).cells;

			let values = [];
			for (var j = 0; j < objCells.length; j++) {
				console.log(objCells.item(j).innerText);
				let line = objCells.item(j).innerText.split("\n");

				for (let k = 0; k < line.length; k++) {
					//data.push(line[k]);
				}
				data.push(line);
			}
		}

		return data;
	}, fields);

	//make list of field names and values, key value pairs
	var list = [];

	var lastField = "";

	//even are field names and odd are values, make into key value pairs
	for (let i = 0; i < logLabels.length; i++) {
		if (i % 2 == 0) {
			lastField = logLabels[i][0];
		} else {
			list.push({ [lastField]: logLabels[i][0] });
		}
	}

	// do we see carton 1 text in array
	var carton1Text = getValue(list, fields.carton1Field);
	var carton2Text = getValue(list, fields.carton2Field);
	var carton3Text = getValue(list, fields.carton3Field);
	var carton4Text = getValue(list, fields.carton4Field);
	var carton5Text = getValue(list, fields.carton5Field);

	//console.log(carton1Text);
	//console.log(carton2Text);
	// console.log(carton3Text);
	// console.log(carton4Text);
	// console.log(carton5Text);

	//read cartons
	//@ts-ignore
	// let carton1Text = await pageCarton.evaluate((fields) => parseInt(document.querySelector(fields.Carton1).textContent), fields);
	//@ts-ignore
	//let carton2Text = await pageCarton.evaluate((fields) => parseInt(document.querySelector(fields.Carton2).textContent), fields);
	//@ts-ignore
	// let carton3Text = await pageCarton.evaluate((fields) => parseInt(document.querySelector(fields.Carton3).textContent), fields);
	//@ts-ignore
	// let carton4Text = await pageCarton.evaluate((fields) => parseInt(document.querySelector(fields.Carton4).textContent), fields);
	//@ts-ignore
	// let carton5Text = await pageCarton.evaluate((fields) => parseInt(document.querySelector(fields.Carton5).textContent), fields);

	await pageCarton.click("#navigation > div:nth-child(3) > a");

	if (toteText1 == "" || toteText1 == null) {
		console.error("Order Start Status Update - Tote 1 text not visible");
		return;
	}

	if (toteText2 == "" || toteText2 == null) {
		console.error("Order Start Status Update - Tote 2 text not visible");
		return;
	}

	setOrCreateValueInDb("dematic_dashboard_WMS_OrderTotes", toteText1);
	setOrCreateValueInDb("dematic_dashboard_WMS_OrderTotes_DMS", toteText2);

	//update data into the Db for each tote and carton (if record exists then update, else insert)
	for (let i = 0; i < 5; i++) {
		setOrCreateValueInDb(
			"dematic_dashboard_WMS_carton_erector_" + (i + 1),
			eval("carton" + (i + 1) + "Text")
		);
	}

	//done
	console.log("Order Start Status Update - Done");

	//if (!result) {
	//  console.error("Order Start Status Update - Carton 2 text not visible");
	//  return;
	// }
}

async function setOrCreateValueInDb(parameter: string, valueInit: string) {
	//convert to string
	let value = valueInit.toString();

	await db.siteParameters.upsert({
		where: {
			name: parameter,
		},
		create: {
			name: parameter,
			value: value,
			location: "default location", // Add appropriate value
			description: "default description", // Add appropriate value
			lastUpdated: new Date(),
		},
		update: {
			value: value,
			lastUpdated: new Date(),
		},
	});
}

function getValue(list: any[], valueToFind: string) {
	var found = false;

	var value = "";

	//loop through the list
	for (let i = 0; i < list.length; i++) {
		//get the key
		let key = Object.keys(list[i])[0];

		//if the key is the selector
		if (key == valueToFind) {
			//set found to true
			found = true;

			//get the value
			value = list[i][key];

			break;
		}
	}
	return parseInt(value);
}

//function to return the hours between two dates
function hoursBetweenToDates(date1: Date, date2: Date) {
	var diff = Math.abs(date1.getTime() - date2.getTime());
	return Math.ceil(diff / (1000 * 3600));
}

//export
export default {
	loginToWMS,
	updateOrderStartStatus,
	//wmsLogs,
	checkPassword,
	//exceptions,
	//tours,
	dms: { shuttleCounts },
};
