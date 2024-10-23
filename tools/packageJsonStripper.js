import fs from "fs";

// Read the package.json file
const packageJson = fs.readFileSync("./package.json", "utf8");

// Parse the package.json file
const packageJsonParsed = JSON.parse(packageJson);

// Remove the devDependencies from the package.json file
delete packageJsonParsed.devDependencies;

// Write the packageProduction.json file
fs.writeFileSync("./packageProduction.json", JSON.stringify(packageJsonParsed, null, 2));
