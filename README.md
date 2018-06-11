# openhab2 nodejs-tuyaapi
Openhab interface for Tuya home automation devices sold under various names.
This is a wrapper script for codetheweb/tuyapi. https://github.com/codetheweb/tuyapi

Its based on the exec-binding https://www.openhab.org/addons/bindings/exec/

Many thangs to https://github.com/unparagoned/njsTuya for the inspirations

## Instructions:

Download this project to your openhab2-script-folder "/etc/openhab2/scripts" and install tuyapi from the same folder that the tuya.js is in
```
cd /etc/openhab2/scripts
git clone git@github.com:codetheweb/tuyapi.git //or download
cd tuyaapi_openhab
npm install //downloads codetheweb/tuyapi
```

Ignore all Warnings.

This involves MIM of the connection. Instructions can be found here: https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md

Commands are
```
node njstuya.js --ip=DEVICEIP --id=DEVICEID --key=DEVICEKEY COMMAND
    --> Commands are ON, OFF, TOGGLE, STATE

e.g.
node njstuya.js --ip=10.0.0.2 --id=213klj349sdfjl324po32 --key=342kljerw98 ON
```
All commands return the state of the switch.

#### Issues
There are some reliability issues with tuyapi. Latest changes changed the syntax but still getting error maybe at an even higher rate.

## Example things and items

### Things

#### create things-file
```
Thing exec:command:tuya_switch "Tuya Gateway"  @ "System" [
    command="node /etc/openhab2/scripts/tuyaapi_openhab/tuya.js %2$s", 
    transform="REGEX((.*?))",
    interval=0,
    timeout=1,
    autorun=true]
```

#### create items-file
```
Group:Switch gTuya  "Tuya devices"
Group gTuyaDetails  "Tuya details"
Group gTuyaConfigs  "Tuya configs"
Group gTuyaSwitches "Tuya switches"

Switch tuya      { channel="exec:command:tuya_switch:run"    }
String tuya_Args { channel="exec:command:tuya_switch:input"  }
String tuya_Out  { channel="exec:command:tuya_switch:output" }

String tuya_kitchen_waterheater_config "--id=<devId> --key=<devKey> --ip=<devIp>" (gTuya, gTuyaConfigs) //Config for execution
String tuya_kitchen_waterheater_trigger "tuya_kitchen_coffeemachine_switch" (gTuya, gTuyaConfigs) //trigger other switch with name "tuya_kitchen_coffeemachine_switch"
Switch tuya_kitchen_waterheater_switch "Steckdose Wasserkocher" <socket> (Kitchen, gTuya, gTuyaSwitches) ["Switchable"]

String tuya_kitchen_coffeemachine_config "--id=<devId> --key=<devKey> --ip=<devIp>" (gTuya, gTuyaConfigs) //Config for execution
String tuya_kitchen_coffeemachine_trigger "tuya_kitchen_waterheater_switch" (gTuya, gTuyaConfigs) //trigger other switch with name "tuya_kitchen_waterheater_switch"
Switch tuya_kitchen_coffeemachine_switch "Steckdose Kaffeemaschine" <socket> (Kitchen, gTuya, gTuyaSwitches) ["Switchable"]
```

#### create rules-file
copy the file from this project "openhab2/rules/tuya-switch.rules" to your openhab rules foulder "/etc/openhab2/rules/

**This Rule only works since openHAB 2.3.0 Build #1212. Before that the Member of trigger was not availabel.**
```
import java.util.concurrent.locks.ReentrantLock

val ReentrantLock locktuya = new ReentrantLock
var db = true

rule "Tuya switcher"
when
    Member of gTuyaSwitches received command
then
    var appName = "tuya.switch";
    logInfo(appName, "Member " + triggeringItem.name + " changed to " + receivedCommand);
    try {
        // Lock transmitter so other executed rules dont't use it at the same time.
        // Concurrent calls of the rule will wait till the resource is free again.
        locktuya.lock();

        val name = triggeringItem.name.toString.split("_switch").get(0);
        val config = name + "_config";
        var relatedConfig = gTuyaConfigs.allMembers.filter [ conf | conf.name.contains(config.toString) ].head;
        config = relatedConfig.label;

        // send command to nodejs function
        var args = config + " " + receivedCommand.toString;
        tuya_Args.sendCommand(args);

        // Wait for the command to complete
        while(tuya.state != OFF){
            Thread::sleep(100);
        }

        // Mulltiple trigger do not work if there is no break here
        // maybe external skript needs some time to properly free resources.
        Thread::sleep(400);

        // Set related item
        var trigger = name + "_trigger";
        var relatedTrigger = gTuyaConfigs.allMembers.filter [ conf | conf.name.contains(trigger.toString) ].head;
        if(relatedTrigger != null){
            var triggerItem = gTuyaSwitches.allMembers.filter [ conf | conf.name.contains(relatedTrigger.label.toString) ].head;
            logInfo(appName, "Triggered: " + triggerItem.name.toString);
            triggerItem.postUpdate(receivedCommand);
        }

        var output = tuya_Out.state.toString.replaceAll("\r|\n"," ");
        if(output != "ON" && output != "OFF"){
            logError(appName, "State changed to " + output)
        } else {
            logInfo(appName, "State changed to " + output)
        }
    }catch(Throwable t) {
        logInfo(appName, t);
    }
    finally {
        // Free the resource for the next call.
        locktuya.unlock()
    }
end
```
Rules are also explained in the [tutorials](https://docs.openhab.org/tutorials/beginner/rules.html). Basic thing to get some action is tuya_Args.sendCommand(“--id=<devId> --key=<devKey> --ip=<devIp>”)” sending a command to the input channel. This will set the state of the item “tuya_Args to” “--id=<devId> --key=<devKey> --ip=<devIp>” and the autorun defined in the thing will cause an execution of the command line. While the thing is in action the state of the item “tuya” will reflect this by beeing “ON”. After the command is executed the item tuya_Out will contain the last return value of the executed command.


```
rule "Tuya status cron"
when
    Time cron "0 0/5 * * * ?"
then
    var appName = "tuya.cron";
    logInfo(appName, "Cron status update");
    if(!locktuya.isLocked()){
        locktuya.lock();
        var titerator = gTuyaSwitches.members.iterator
        while(titerator.hasNext){
            val det = titerator.next

            val config = det.name.toString.split("_switch").get(0) + "_config";
            var relatedConfig = gTuyaConfigs.allMembers.filter [ conf | conf.name.contains(config.toString) ].head;
            config = relatedConfig.label;

            var args = config + " now";
            var output = executeCommandLine("node /etc/openhab2/scripts/tuya-api/tuya.js " + args, 5000);
            det.postUpdate(output);
            if(output != "ON" && output != "OFF"){
                logError(appName, "State changed to " + output)
            } else {
                logInfo(appName, "State changed to " + output)
            }

            if(db) { logInfo(appName, "Update [{}]", args)}
        }
        locktuya.unlock()
    }
end
```
Time-based rule get the current state of the switch and set it manualy in openhab. This rule triggers every 5 minutes

## Useage
### Basic UI sitemap
```
Switch item=tuya_kitchen_waterheater_switch mappings=[ON="On", OFF="Off"]
Switch item=tuya_kitchen_coffeemachine_switch mappings=[ON="On", OFF="Off"]
```

## Related Projects:
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/codetheweb/tuyapi
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)