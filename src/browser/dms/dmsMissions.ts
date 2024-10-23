//Service for Dematic Dashboard Screwfix trentham to collect data from WMS about DMS missions and push to DB
//DMS Exceptions log function
//Created by: JWL
//Date: 2023-01-30
//Last modified: 2024/07/31 04:43:18
//Version: 0.0.1

//imports
import * as puppeteer from "puppeteer";

// @ts-ignore
import mysql from "../../db/mysqlConnection.js";

import wmsLogs from "../logs/wmsLogs.js";

//variables
const amountOfAisles = 3;
const amountOfLevels = 25;

//function to get the DMS Exceptions logs
async function getAndInsertDMSMissionsToDB(browserInstance: puppeteer.Browser, mainHost: string, date: string) {
  console.log("Getting DMS Missions");

  // for each aisle get the missions
  for (var aisle = 1; aisle < amountOfAisles + 1; aisle++) {
    await getDMSMissionsForAisle(browserInstance, mainHost, date, aisle);
  }
}

async function getDMSMissionsForAisle(browserInstance: puppeteer.Browser, mainHost: string, date: string, aisle: number) {
  console.log("Getting DMS Missions for Aisle: " + aisle);

  //which log file do we need to look at - depending on the aisle
  //"Multi Shuttle PLC X Communications log file"
  let logFile = "Multi Shuttle PLC " + aisle + " Communications log file";

  const results = await wmsLogs.getLogFiles(browserInstance, mainHost, date, [logFile], "RTUNO");

  //console.log("Results: " + JSON.stringify(results));

  //loop through the results check the message

  if (results.data?.length == 0) {
    console.log("No data found for log file: " + logFile);
    return;
  }

  let data = results.data;

  if (data == undefined) {
    console.log("No data found for log file: " + logFile);
    return;
  }

  //loop through the data
  const mainArray = splitMultiMessageDCI(data);

  //ask the db for what shuttles are in the aisle
  let query = "SELECT * FROM shuttles";
  let shuttleData = await mysql.query(query);

  //loop though the main array and make stats

  let shuttleStats: ShuttleStats[] = [];

  //populate the shuttle stats array for 25 levels
  for (var j = 0; j < amountOfLevels; j++) {
    let shuttleId = "Unknown";

    //loop through the shuttleData and find what shuttle is on this level
    for (var i = 0; i < shuttleData.length; i++) {
      try {
        let Location = shuttleData[i].Location;

        //level is the 9th and 10th character
        let level = parseInt(Location.substring(8, 10));

        //aisle is the 6th and 7th character
        let aisle2 = parseInt(Location.substring(5, 7));

        if (level == j + 1 && aisle2 == aisle) {
          shuttleId = shuttleData[i].ID;
          break;
        }
      } catch (e) {
        // console.log(e);
      }
    }

    shuttleStats.push({
      shuttleId: shuttleId,
      level: j + 1,
      picks: 0,
      drops: 0,
      IATs: 0,
    });
  }

  for (var i = 0; i < mainArray.length; i++) {
    //message is 114 characters long
    let message = mainArray[i].message;

    //get the source first 14 characters
    let source = message.substring(0, 14);

    //current location next 14 characters
    let currentLocation = message.substring(14, 28);

    //destination next 14 characters
    let destination = message.substring(28, 42);

    //next 8 is the ul
    let ul = message.substring(42, 50);

    //if current location is contains "LV" then this mission is for a shuttle if not then continue
    if (currentLocation.includes("LV") == false) {
      continue;
    }

    // the level is the 9th and 10th character
    let level = parseInt(currentLocation.substring(8, 10));

    let pickORdrop = "IAT";

    //if the source contains "RI" - Rack in then it is a pick
    if (source.includes("RI")) {
      pickORdrop = "PICK";
    }

    //else if the source contains "RO" - Rack out then it is a drop
    if (destination.includes("RO")) {
      pickORdrop = "DROP";
    }

    //if source is RI and destination is RO then must of been a WMS issue.
    if (source.includes("RI") && destination.includes("RO")) {
      pickORdrop = "NR?";
    }

    //add the stats to the array for each level

    if (pickORdrop == "PICK") {
      shuttleStats[level - 1].picks++;
    } else if (pickORdrop == "DROP") {
      shuttleStats[level - 1].drops++;
    } else if (pickORdrop == "IAT") {
      shuttleStats[level - 1].IATs++;
    }
  }

  //console.log("Shuttle Stats: ");
  //console.table(shuttleStats);

  //insert the data into the db
  for (var i = 0; i < shuttleStats.length; i++) {
    let stat = shuttleStats[i];

    let query = `INSERT INTO shuttleMissions (timeRange, aisle, level, shuttleId, picks, drops, IATs) VALUES ('${date}', ${aisle}, ${stat.level}, '${stat.shuttleId}', ${stat.picks}, ${stat.drops}, ${stat.IATs})`;

    console.log("Query: " + query);
    await mysql.query(query);
  }
}

type ShuttleStats = {
  shuttleId: string;
  level: number;
  picks: number;
  drops: number;
  IATs: number;
};

function splitMultiMessageDCI(data: { i: number; time: string; log: string; message: string }[]) {
  let mainArray: any[] = [];
  for (var i = 0; i < data.length; i++) {
    let message = data[i].message;

    //get the part after "/RTUMI"
    let messageParts = message.split("/RTUNO");

    //if the message is not long enough then continue
    if (messageParts.length < 2) {
      continue;
    }

    //remove the first 22 characters
    let messagePart = messageParts[1].substring(22);

    //each message is 114 characters long
    //split the message into 114 character parts
    let messageParts2 = messagePart.match(/.{1,114}/g);

    if (messageParts2 == null) {
      continue;
    }

    //loop through the parts adding to the main array
    for (var j = 0; j < messageParts2.length; j++) {
      //if the message is not long enough then continue
      if (messageParts2[j].length < 114) {
        continue;
      }

      mainArray.push({ timestamp: data[i].time, message: messageParts2[j] });
    }
  }

  return mainArray;
}

//export the function
export default { getAndInsertDMSMissionsToDB };
