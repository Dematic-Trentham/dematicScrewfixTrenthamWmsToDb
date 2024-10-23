//Service for Dematic Dashboard Screwfix trentham to collect data from WMS about DMS tours and push to DB
//DMS tours log function
//Created by: JWL
//Date: 2023-01-31
//Last modified: 2023/02/02 01:04:17
//Version: 0.0.1

//imports
// @ts-ignore
import dematic from "dematic-master-lib";
//@ts-ignore
import misc from "../../misc.js";

import * as puppeteer from "puppeteer";

// @ts-ignore
import mysql from "../../db/mysqlConnection.js";

import wms from "../wms.js";
import wmsLogs from "../logs/wmsLogs.js";

async function getAndInsertDMSTours(browserInstance: puppeteer.Browser, mainHost: string) {
  //make new tab
  const page = await browserInstance.newPage();

  try {
    //go to the tours page
    await page.goto(mainHost + "/cgi-bin/web_om_td1.exe#scr=std_list_MH_MS_DCI_TOUR&listsize=500&sortmethod1=5268&rvssort1=0", {
      waitUntil: "networkidle2",
    });

    //wait for the page to load
    await page.waitForSelector("#tools > div:nth-child(6) > a");

    //get the tours table
    const tours = await page.evaluate(() => {
      //Running on Page
      let data = [];
      let table = document.getElementById("listtbl1");

      //@ts-ignore
      for (var i = 1; i < table.rows.length; i++) {
        //@ts-ignore
        let objCells = table.rows.item(i).cells;

        let values = [];
        for (var j = 0; j < objCells.length; j++) {
          let text = objCells.item(j).innerHTML;
          values.push(text);
        }
        let d = { i, values };
        data.push(d);
      }

      return data;
    });

    //object to store the tours
    let toursArray: any[] = [];

    //loop through the tours
    for (var i = 0; i < tours.length; i++) {
      //if undefined then skip
      if (tours[i] === undefined) continue;

      //if values is undefined or empty then skip
      if (tours[i].values === undefined || tours[i].values.length === 0) continue;

      //create an object of the tour
      let tour = {
        tourID: tours[i].values[0].split("\n")[2],
        status: tours[i].values[1].replace("\n ", "").replace(" \n", ""),
        stateChange: tours[i].values[2].replace("\n ", "").replace(" \n", ""),
        type: tours[i].values[3].replace("\n ", "").replace(" \n", ""),
        shuttleId: tours[i].values[4].split("\n")[2],
        elevatorId: tours[i].values[5].split("\n")[2],
        tourNo: tours[i].values[6].replace("\n ", "").replace(" \n", ""),
        tourStartTime: tours[i].values[7].replace("\n ", "").replace(" \n", ""),
        recordNumber: tours[i].values[0].split("\n")[1].split("rec=")[1].split("&amp;")[0],
      };

      //get tour start time
      let tourStartTime = new Date(tour.tourStartTime);

      //get the current time
      let currentTime = new Date();

      //Calculate the tour duration in seconds
      let tourDuration = (currentTime.getTime() - tourStartTime.getTime()) / 1000;

      //if the tour is more than 5 minutes old then it is stuck
      if (tourDuration > 5) {
        insertStuckTour(browserInstance, mainHost, tour);
      }
    }
  } catch (error) {
    console.log(error);
  } finally {
    await page.close();
  }
}

async function insertStuckTour(browserInstance: puppeteer.Browser, mainHost: string, tour: any) {
  console.log(tour);

  //create a new page
  let page = await browserInstance.newPage();

  //go to the tour details page
  await page.goto(mainHost + "/cgi-bin/web_om_td1.exe#scr=std_detail_MH_MS_DCI_TOUR&CurrentDetailTab=5149&rec=" + tour.recordNumber, {
    waitUntil: "networkidle2",
  });

  try {
    //click on 'MS Tour Items' tab
    await page.waitForSelector("#content > table:nth-child(3) > tbody > tr > td > div > div:nth-child(2)");
    await page.click("#content > table:nth-child(3) > tbody > tr > td > div > div:nth-child(2)");

    //wait for selector for the table
    await page.waitForSelector("#listtbl1");

    //get table about the tour
    const tourRawDetails = await page.evaluate(() => {
      //Running on Page
      let data = [];
      let table = document.getElementById("listtbl1");

      //@ts-ignore
      for (let i = 1; i < table.rows.length; i++) {
        //@ts-ignore
        let objCells = table.rows.item(i).cells;

        let values = [];

        for (var j = 0; j < objCells.length; j++) {
          let text = objCells.item(j).innerHTML;
          values.push(text);
        }

        let d = { i, values };
        data.push(d);
      }

      return data;
    });

    console.log("tourRawDetails");
    console.log(tourRawDetails);

    //make objects for each item
    let tourPageItems = [];
    for (let i = 0; i < tourRawDetails.length - 1; i++) {
      console.log(tourRawDetails[i]);

      try {
        let obj = {
          ul: tourRawDetails[i].values[1].split("\n")[2],
          currentLocation: tourRawDetails[i].values[4].split("\n")[2],
          finalDestination: tourRawDetails[i].values[2].split("\n")[2],
          status: tourRawDetails[i].values[8].split("\n")[1],
        };

        tourPageItems.push(obj);
      } catch (error) {
        console.log(error);
      }
    }

    console.log("tourPageItems");
    console.log(tourPageItems);

    //get the ul details to get the location of each item in the tour
    for (let i = 0; i < tourPageItems.length; i++) {
      console.log(tourPageItems[i]);
    }
  } catch (error) {
    console.log(error);
  } finally {
    await page.close();
  }
}

//export the functions
export default {
  getAndInsertDMSTours,
};
