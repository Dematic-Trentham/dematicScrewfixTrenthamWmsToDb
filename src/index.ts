//Service for Dematic Dashboard Screwfix trentham to collect data from WMS ( Matflow ) and push into the dashboard database
//Created by: JWL
//Date: 2024/10/23
//Last modified: 2024/11/04 05:15:5
const version = "1.0.0";

//imports
import cron from "node-cron";
import * as puppeteer from "puppeteer";

import browser from "./browser/browser.js";
import wms from "./browser/wms.js";

//startup text
console.log("Dematic Dashboard Micro Service - WMS To DB");
console.log("Starting WMS To DB Service ....");

console.log("Starting WMS To DB Service v" + version + " ....");

//url of wms - this will be set by the login function
let mainHost = "http://localhost:3000";

//run every 5 seconds
cron.schedule("*/5 * * * * *", async () => {
	console.log();
	console.log("Running 5s cron job");

	SecondsStillRunning5 = "running";

	//start timer for this function
	const start = Date.now();
	const tasks = [
		{
			name: "read Order Start",
			task: () => {
				if (pages.totePage == null || pages.CartonPage == null) {
					return;
				}

				browser.wms.updateOrderStartStatus(pages.totePage, pages.CartonPage);
			},
		},
	];
	await Promise.all(
		tasks.map(({ name, task }) => {
			try {
				task();
			} catch (error) {
				console.error(`Error in function ${name}:`, error);
			}
		})
	);

	SecondsStillRunning5 = "notRunning";

	//how long did this function take to run?
	const end = Date.now();

	//make a nice percentage  - (end - start) / 10000) * 100 + "%"
	let percent = ((end - start) / 5000) * 100;
	percent = Math.round(percent * 100) / 100;

	//how much percent of the 3 seconds did this function take?
	console.log("Percent of 5 seconds : " + percent + "%");
});

//counters for the 5s cron job - to check for missed runs
let reloadMissedCounter = 0;
let SecondsStillRunning5 = "notRunning";

//running objects
let browserInstance: puppeteer.Browser;
let pages = {
	totePage: null as puppeteer.Page | null,
	CartonPage: null as puppeteer.Page | null,
};

//every minute run functions
cron.schedule("*/1 * * * *", async () => {
	try {
		pageRefresh();
	} catch (e) {
		console.log("Error in pageRefresh", e);
	}
});

//every 2 days check the password
cron.schedule("0 0 */2 * *", checkPassword);

async function pageRefresh() {
	if (SecondsStillRunning5 !== "notRunning") {
		setTimeout(() => {
			console.log(
				"Waiting for function to finish a: " +
					reloadMissedCounter +
					" " +
					SecondsStillRunning5
			);
			reloadMissedCounter++;
			if (reloadMissedCounter > 60) {
				console.log("Killing process a");
				process.exit(0);
			} else {
				pageRefresh();
			}
		}, 1000);
		return;
	}

	reloadMissedCounter = 0;

	//check if the browser is running
	await checkBrowserStatus();

	//refresh all pages
	await browser.refreshAllTabs(browserInstance);
}

async function checkBrowserStatus() {
	if (browserInstance == null) {
		//spawn a new browser
		browserInstance = await browser.startBrowser(true);

		//login to WMS
		const host = await browser.wms.loginToWMS(browserInstance);

		mainHost = host;
		//open the tote page
		pages.totePage = await browser.openNewTab(
			browserInstance,
			host + "/cgi-bin/web_om_td1.exe#scr=workloadlimitssum&LimitTab=2"
		);

		//open the carton page
		pages.CartonPage = await browser.openNewTab(
			browserInstance,
			host +
				"/cgi-bin/web_om_td1.exe#scr=std_detail_MAT_FLOW&CurrentDetailTab=1804"
		);
	}
}

async function checkPassword() {
	console.log("Checking password1");
	if (SecondsStillRunning5 !== "notRunning") {
		setTimeout(() => {
			console.log(
				"Waiting for function to finish b: " +
					reloadMissedCounter +
					" " +
					SecondsStillRunning5
			);
			reloadMissedCounter++;

			if (reloadMissedCounter > 60) {
				console.log("Killing process b");
				process.exit(0);
			} else {
				checkPassword();
			}
		}, 1000);
		return;
	}

	console.log("Checking password2");

	reloadMissedCounter = 0;

	SecondsStillRunning5 = "password";

	await browser.wms.checkPassword(browserInstance, mainHost);

	SecondsStillRunning5 = "notRunning";
}

await checkBrowserStatus();

//restart the browser every 5 minutes
cron.schedule("2 * * * *", async () => {
	try {
		//wait until the function is not running
		reload();
	} catch (e) {
		console.log(e);
	}
});

async function reload() {
	if (SecondsStillRunning5 !== "notRunning") {
		setTimeout(() => {
			console.log(
				"Waiting for function to finish c: " +
					reloadMissedCounter +
					" " +
					SecondsStillRunning5
			);
			reloadMissedCounter++;

			if (reloadMissedCounter > 60) {
				console.log("Killing process c");
				process.exit(0);
			} else {
				reload();
			}
		}, 1000);

		return;
	}

	SecondsStillRunning5 = "Reload";

	reloadMissedCounter = 0;

	//close all the pages
	await browser.closeBrowser(browserInstance);

	browserInstance = await browser.startBrowser(true);

	//login to WMS
	const host = await browser.wms.loginToWMS(browserInstance);

	//open the tote page
	pages.totePage = await browser.openNewTab(
		browserInstance,
		host + "/cgi-bin/web_om_td1.exe#scr=workloadlimitssum&LimitTab=2"
	);

	//open the carton page
	pages.CartonPage = await browser.openNewTab(
		browserInstance,
		host +
			"/cgi-bin/web_om_td1.exe#scr=std_detail_MAT_FLOW&CurrentDetailTab=1804"
	);

	SecondsStillRunning5 = "notRunning";
}

//1 hour cron job (5 minute past the hour)
cron.schedule("5 * * * *", async () => {
	try {
		console.log("get shuttle dms counts");
		await wms.dms.shuttleCounts.getShuttleCounts(browserInstance, mainHost);
	} catch (e) {
		console.log(e);
	}
});

setTimeout(async () => {
	await checkPassword();
}, 15000);
