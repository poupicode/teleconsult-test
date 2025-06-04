# Patient Interface
- [Installation Execution](#installation-execution)
- [Key Files](#key-files)
- [Service Configuration](#service-configuration)
- [Authpr Patient](#author-patient)


## Installation Execution

Clone the repository and install dependencies:
  npm install
  # or yarn install

Start the development server:
  npm run dev
  # or yarn start

In your browser, click on Log In and select the Bluetooth device.


## Key Files

config.ts: Declares the deviceType structure for services and characteristics:


parsers.ts: Contains decoding functions for Bluetooth formats:
    readSfloat16 for SFLOATs (2 bytes)
    readIEEE11073Float for IEEE 11073 floats (4 bytes)
    readDateTime for dates

services.ts: Exposes the configureNotifications function:
    Connects to the GATT service using serviceKey
    Starts notifications for each characteristic
    Parses fixed and conditional fields according to config.ts
    Calls addOrUpdateCard(...) and setStatus(...) to update the UI

BluetoothContext.tsx: Main React component:
    Handles connection, auto-reconnection, and supported service selection
    Stores state (status, connectedCards)
    Calls configureNotifications and updates the UI via addOrUpdateCard

ButtonConnexionApp.tsx: Generic button to trigger Bluetooth connection.

ServiceCard.tsx: UI component for displaying a measurement card: service name, device name, and list of measurements.


## Service Configuration
For define the Service in config.ts (To Add a Device)

- Open config.ts.
- Add a new key corresponding to the GATT service identifier (refer to the manufacturer’s Bluetooth specification).
- Under this key, declare one or more characteristics.
- For each characteristic, specify:
  decoder: decoding function (e.g. readSfloat16 or readIEEE11073Float).
  For each fixed field (always present):
    myField: {
      name: "Displayed label",
      value: OFFSET, // byte offset
    }
  For each conditional field (present depending on a flag):
    myConditionalField: {
      name: "Displayed label",
      data: 0bxxxx,    // flag bitmask to check
      offset?: OFFSET, // optional if dynamically calculated
    }

## Author Patient
**Guerric COCHELIN**

----------------------------------------------------------------------------------------------------------------------------
# The Doctor Interface (logic part only)
To display for the doctor side the datas received by the nurse side.

- [Objective](#objective)
- [Main changes](#main-changes)
- [Tests](#tests)
- [Notes / Limits](#notes--limits)
- [Author](#author)

## Objective
The doctor can see in real time the latest datas of each measures done by each devices send by the nurse side directly on navigator and he can as well see the measures' historic of each devices.

## Main changes
- Creation of the component **DoctorInterface**
- Add the function to stock the data received by the nurse side in JSON object entered by an input
- Add the function to build the final object wich regroup all data received by the nurse side comparing the service of the data received and all the services already received in the final object
- Add an input with a send button to paste the data received by the nurse side to simulate a data received in real time after each measure

## Tests
How to test the **DoctorInterface** : 
- Lauch npm run dev
- Directly on the navigator under the other components, entry the data received in the input (the component will be remove of the nurse interface)
- Click on the send button
- The final object wich regroup all data received and wich will be display on the doctor interface to see in real time the measures of each device will be display actually on the navigator's console

## Notes / Limits
- The doctor interface is not yet created, the component is actually on the nurse interface
- The display of the final object of the data received is not yet added
- The button to show the precedent datas for each device is not yet added

## Author
**Magali MAI**