//Service for Dematic Dashboard Screwfix trentham to collect data from WMS and push to DB
//Browser functions
//Created by: JWL
//Date: 2022-12-30
//Last modified: 2024/10/23 17:52:13
//Version: 0.0.1

import * as puppeteer from "puppeteer";

import wms from "./wms.js";

//start up and return the browser object
async function startBrowser(headless: boolean): Promise<puppeteer.Browser> {
	//am i inside a docker container?
	const isDocker = true;

	console.log("Is Docker: " + isDocker);

	var browserOptions;
	//if we are running in docker
	if (isDocker) {
		//set the browser options
		browserOptions = {
			headless: true,
			executablePath: "/usr/bin/chromium-browser",
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-accelerated-2d-canvas",
				"--no-first-run",
				"--no-zygote",
				"--single-process", // <- this one doesn't works in Windows
				"--disable-gpu",
				"--disable-dev-shm-usage",
			],
			//ignoreHTTPSErrors: true,
			defaultViewport: null,
			slowMo: 0,
			timeout: 0,
		};
	} else {
		//set the browser options

		browserOptions = {
			headless: false,

			//chrome on windows exe path
			executablePath:
				"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

			//ignoreHTTPSErrors: true,
			defaultViewport: null,
			slowMo: 0,
			timeout: 0,
		};
	}

	//  console.log("Make 1");

	//start the browser and create a browser instance within docker container
	const browser = await puppeteer.launch(browserOptions);

	// console.log("Make 2");
	console.log("Browser started");

	//return browser object
	return browser;
}

//open new tab
async function openNewTab(browserInstance: puppeteer.Browser, url?: string) {
	let pages1 = await browserInstance.pages();

	//create a new tab
	const page = await browserInstance.newPage();
	//console.log("Opening new tab: " + url);

	//if the url is not null
	if (url != null) {
		//go to the url
		await page.goto(url, { waitUntil: "networkidle2" });
	}

	//return the page object
	return page;
}

//refresh all tabs
async function refreshAllTabs(pageArray: any) {
	console.log("Refreshing all tabs ...");

	//loop through all pages
	for (var i = 0; i < pageArray.length; i++) {
		//go to the url
		await pageArray[i].goto(pageArray[i].url(), { waitUntil: "networkidle2" });

		console.log("Refreshing page: " + pageArray[i].url());
	}
}

//close the browser
async function closeBrowser(browserInstance: puppeteer.Browser) {
	await browserInstance.close();
}

//return if selector exists
async function selectorVisible(
	page: puppeteer.Page,
	selector: string,
	timeout?: number
): Promise<boolean> {
	//if timeout is not defined then set it to 500
	if (timeout == null) {
		timeout = 500;
	}

	let result = await page
		.waitForSelector(selector, { visible: true, timeout: timeout })
		.then(() => true)
		.catch(() => false);

	return result;
}

async function closeAllTabs(browser: puppeteer.Browser) {
	//get all pages
	const pages = await browser.pages();

	//loop through all pages
	for (var i = 0; i < pages.length; i++) {
		//close the page
		await pages[i].close();
	}
}

//function to check if element is visible and then return the text
async function checkAndGetText(
	page: puppeteer.Page,
	selector: string,
	timeout?: number
): Promise<string> {
	//if timeout is not defined then set it to 500
	if (timeout == null) {
		timeout = 500;
	}

	//if the selector is not visible then return empty string
	if (selectorVisible == null) {
		console.log("Selector not visible: " + selector);
		return "";
	}

	//get the text
	let text;

	try {
		text = await page.$eval(selector, (el) => el.textContent);
	} catch (error) {
		text = "";
	}

	//check if the text is null
	if (text == null) {
		text = "";
	}
	//remove blank spaces before and after the text
	text = text.trim();

	//return the text
	return text;
}

//export the functions
export default {
	startBrowser,
	openNewTab,
	closeBrowser,
	selectorVisible,
	checkAndGetText,
	closeAllTabs,
	refreshAllTabs,
	wms,
};
