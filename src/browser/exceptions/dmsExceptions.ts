//Service for Dematic Dashboard Screwfix trentham to collect data from WMS about DMS Exceptions and push to DB
//DMS Exceptions log function
//Created by: JWL
//Date: 2023-01-30
//Last modified: 2023/02/04 19:14:25
//Version: 0.0.1

//imports
// @ts-ignore
import dematic from "dematic-master-lib";
//@ts-ignore
import misc from "../../misc.js";

import * as puppeteer from "puppeteer";

// @ts-ignore
import mysql from "../../db/mysqlConnection.js";

import wmsLogs from "../logs/wmsLogs.js";

let UnknownType = 0;

//function to get the DMS Exceptions logs
async function getAndInsertDMSExceptions(browserInstance: puppeteer.Browser, mainHost: string, date: string) {
  //get mysql data of shuttle in aisle
  let sql =
    "SELECT A.ShuttleLocation, A.TimeStamp, B.MacAddress, B.ID from DMS.shuttleLocations AS A INNER JOIN DMS.MacToID AS B ON A.ShuttleMacAddress = B.MacAddress";
  var shuttleLocations = await mysql.query(sql);

  //convert array into key pair
  let shuttleLocationsKeyPair = [];
  for (var i = 0; i < shuttleLocations.length; i++) {
    shuttleLocationsKeyPair[shuttleLocations[i].ShuttleLocation] = shuttleLocations[i];
  }

  //console.log(shuttleLocationsKeyPair);

  //get the dms exceptions logs
  let dmsExceptionsLogs = await wmsLogs.getLogFiles(
    browserInstance,
    mainHost,
    date,
    ["Multi Shuttle Events log file"],
    "mh_ms_dci_exception MH_DCI_EXCEPTION"
  );

  let currentDate = "";
  UnknownType = 0;

  if (dmsExceptionsLogs == null || dmsExceptionsLogs.data == null) {
    console.log("No DMS Exceptions Logs");
    return;
  }

  for (var i = 0; i < dmsExceptionsLogs.data.length; i++) {
    //console.log(dmsExceptionsLogs.data[i]);
    if (dmsExceptionsLogs.data[i] == null) {
      //console.log("Null Message");
      continue;
    }

    if (dmsExceptionsLogs.data[i].time.startsWith("[")) {
      //update Date
      currentDate = dmsExceptionsLogs.data[i].time.substring(1, dmsExceptionsLogs.data[i].time.length - 1);
      //console.log("Date = " + currentDate);
    } else if (dmsExceptionsLogs.data[i].message != null) {
      var tempShuttleException = await parseShuttleExceptionData(currentDate, dmsExceptionsLogs.data[i], shuttleLocationsKeyPair);
    }
  }

  //console.log("Unknown Type Count = " + UnknownType);

  //console.log(dmsExceptionsLogs);
}

async function parseShuttleExceptionData(
  currentDate: string,
  data: { i?: number; time?: string; log?: string; message?: string; values?: any },
  shuttleLocationsKeyPair: any[]
) {
  try {
    var tempShuttleException = {
      date: "",
      time: "",
      raw: "",
      working: "",
      type: "",
      aisleData: "",
      ul: "",
      tourID: "",
      status: "",
      aisle: "",
      level: "",
      macAddress: "",
      shuttleID: "",
      timestamp: "",
    };

    if (data.message == null || data.time == null) {
      console.log("data.message is null");
      return;
    }

    tempShuttleException["date"] = currentDate;
    tempShuttleException["time"] = data.time;
    tempShuttleException["raw"] = data.message.substring(43);
    tempShuttleException["working"] = data.message.substring(43);

    if (tempShuttleException["working"].startsWith("Retrieval Location Blocked exception at ")) {
      tempShuttleException["type"] = "Retrieval Location Blocked";
      tempShuttleException["working"] = tempShuttleException["working"].substring(40);
    } else if (tempShuttleException["working"].startsWith("Putaway Location Blocked exception at ")) {
      tempShuttleException["type"] = "Putaway Location Blocked";
      tempShuttleException["working"] = tempShuttleException["working"].substring(37);
    } else if (tempShuttleException["working"].startsWith("Bin Full exception at ")) {
      tempShuttleException["type"] = "Bin Full exception";
      tempShuttleException["working"] = tempShuttleException["working"].substring(22);
    } else if (tempShuttleException["working"].startsWith("Bin Empty exception at ")) {
      tempShuttleException["type"] = "Bin Empty exception";
      tempShuttleException["working"] = tempShuttleException["working"].substring(23);
    } else {
      tempShuttleException["type"] = "Unknown";
      UnknownType++;

      return tempShuttleException;
    }

    //MS01:20R069:1:B
    tempShuttleException["aisleData"] = tempShuttleException["working"].substring(0, 15);
    tempShuttleException["working"] = tempShuttleException["working"].substring(20);

    tempShuttleException["ul"] = tempShuttleException["working"].substring(0, 8);
    tempShuttleException["working"] = tempShuttleException["working"].substring(11);

    //split only at first space
    tempShuttleException["tourID"] = tempShuttleException["working"].split(" ", 1)[0];
    tempShuttleException["working"] = tempShuttleException["working"].substring(tempShuttleException["tourID"].length + 27);

    tempShuttleException["status"] = tempShuttleException["working"];

    //get shuttle location
    tempShuttleException["aisle"] = tempShuttleException["aisleData"].substring(2, 4);
    tempShuttleException["level"] = tempShuttleException["aisleData"].substring(5, 7);

    let aisleString = "MSAI" + tempShuttleException["aisle"] + "LV" + tempShuttleException["level"] + "SH01";

    //console.log(shuttleLocationsKeyPair[aisleString]);
        //@ts-ignore
    tempShuttleException["macAddress"] = shuttleLocationsKeyPair[aisleString].MacAddress;
        //@ts-ignore
    tempShuttleException["shuttleID"] = shuttleLocationsKeyPair[aisleString].ID;

    //turn data and time into mysql timestamp
    tempShuttleException["timestamp"] = tempShuttleException["date"] + " " + tempShuttleException["time"];

    //create sql statement
    var sql =
      "insert into DMS.dmsException (timeStamp, type, ul, tourID, status, aisle, level, macAddress, shuttleID,location) values ('" +
      tempShuttleException["timestamp"] +
      "','" +
      tempShuttleException["type"] +
      "','" +
      tempShuttleException["ul"] +
      "','" +
      tempShuttleException["tourID"] +
      "','" +
      tempShuttleException["status"] +
      "','" +
      tempShuttleException["aisle"] +
      "','" +
      tempShuttleException["level"] +
      "','" +
      tempShuttleException["macAddress"] +
      "','" +
      tempShuttleException["shuttleID"] +
      "','" +
      tempShuttleException["aisleData"] +
      "')";

    //run sql statement
    let result = await mysql.query(sql);

    return tempShuttleException;
  } catch (e) {
    console.log(e);

    return;
  }
}

//export the functions
export default {
  getAndInsertDMSExceptions,
};
