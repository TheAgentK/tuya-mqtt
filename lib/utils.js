class Utils
{

    // Check if data is JSON or not
    isJsonString(data) {
        try {
            const parsedData = JSON.parse(data)
            if (parsedData && typeof parsedData === "object") {
                return parsedData
            }
        }
        catch (e) { }

        return false
    }

    // Simple sleep function for various required delays
    sleep(sec) {
        return new Promise(res => setTimeout(res, sec*1000))
    }

    msSleep(ms) {
        return new Promise(res => setTimeout(res, ms))
    }

}

module.exports = new Utils()