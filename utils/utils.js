const child_process = require("child_process");
const crypto = require("crypto");
const { GUID } = require("./constants");

const generateAcceptValue = (acceptKey) => {
  return crypto
    .createHash("sha1")
    .update(acceptKey + GUID, "binary")
    .digest("base64");
};

const parseMessage = (buf) => {
  /*
     *structure of first byte:
         1: if its the last frame in buffer
         2 - 4: reserved bits
         5 - 8: a number which shows what type of message it is. Chart:

             "0": means we continue
             "1": means this frame contains text
             "2": means this is binary
             "0011"(3) - "0111" (11): reserved values
             "1000"(8): means connection closed
             "1001"(9): ping (checking for response)
             "1010"(10): pong (response verified)
             "1010"(11) - "1111"(15): reserved for "control" frames
     structure of second byte:
        1: is it "masked"
        2 - 8: length of payload, if less than 126.
            if 126, 2 additional bytes are added
            if 127 (or more), 6 additional bytes added (total 8)

     * */
  const myFirstByte = buf.readUInt8(0);
  const isThisFinalFrame = isset(myFirstByte, 7);
  const [reserved1, reserved2, reserved3] = [
    isset(myFirstByte, 6),
    isset(myFirstByte, 5),
    isset(myFirstByte, 4),
  ];
  const opcode = myFirstByte & parseInt("1111", 2); //Checks last 4 bits

  // Check if closed connection ("1000"(8))
  if (opcode == parseInt("1000", 2)) return null; // Shows that connection closed

  // look for text frame ("0001"(1))
  if (opcode == parseInt("0001", 2)) {
    const theSecondByte = buf.readUInt8(1);
    const isMasked = isset(theSecondByte, 7); // 1st bit from left side
    let currentByteOffset = 2; // We are theSecondByte now, so 2
    let payloadLength = theSecondByte & 127; // Chcek up to 7 bits

    if (payloadLength > 125) {
      if (payloadLength === 126) {
        payloadLength = buf.readUInt16BE(currentByteOffset); // Read next two bytes from position
        currentByteOffset += 2; // Now we left off at
        // The fourth byte, so thats where we are
      } else {
        // If only the second byte is full,
        // That shows that there are 6 more
        // Bytes to hold the length
        const right = buf.readUInt32BE(currentByteOffset);
        const left = buf.readUInt32BE(
          currentByteOffset + 4 // The 8th byte ??
        );
        throw new Error("brutal " + currentByteOffset);
      }
    }

    /* If we have masking byte set to 1, get masking key
    now that we have the lengths
    and possible masks, read the rest
    of the bytes, for actual data */
    const data = Buffer.alloc(payloadLength);

    if (isMasked) {
      /* Can't just copy it,
      have to do some stuff with
      the masking key and this thing called
      "XOR" to the data. Complicated
      formulas, llook into later */
      let maskingBytes = Buffer.allocUnsafe(4);
      buf.copy(maskingBytes, 0, currentByteOffset, currentByteOffset + 4);
      currentByteOffset += 4;
      for (let i = 0; i < payloadLength; ++i) {
        const source = buf.readUInt8(currentByteOffset++);
        // Now mask the source with masking byte
        data.writeUInt8(source ^ maskingBytes[i & 3], i);
      }
    } else {
      // Just copy bytes directly to our buffer
      buf.copy(data, 0, currentByteOffset++);
    }
    // At this point we have the actual data, so make a json
    const json = data.toString("utf8");
    return parseStr2Json(json);
  } else {
    return "LOL IDK?!";
  }
};
const constructReply = (data) => {
  // Convert the data to JSON and copy it into a buffer
  const json = JSON.stringify(data);
  const jsonByteLength = Buffer.byteLength(json);
  // Note: we're not supporting > 65535 byte payloads at this stage
  const lengthByteCount = jsonByteLength < 126 ? 0 : 2;
  const payloadLength = lengthByteCount === 0 ? jsonByteLength : 126;
  const buffer = Buffer.alloc(2 + lengthByteCount + jsonByteLength);
  // Write out the first byte, using opcode `1` to indicate that the message payload contains text data
  buffer.writeUInt8(0b10000001, 0);
  buffer.writeUInt8(payloadLength, 1);
  // Write the length of the JSON payload to the second byte
  let payloadOffset = 2;
  if (lengthByteCount > 0) {
    buffer.writeUInt16BE(jsonByteLength, 2);
    payloadOffset += lengthByteCount;
  }
  // Write the JSON data to the data buffer
  buffer.write(json, payloadOffset);
  return buffer;
};

const isset = (b, k) => {
  return !!((b >>> k) & 1);
};

const parseStr2Json = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};

const runBuild = () => {
  const URL_FIELD = "Download URL";

  return new Promise((resolve, reject) => {
    const process = child_process.spawn("sh", ["../run-build.sh"], {
      cwd: __dirname,
    });
    // Retured data from runing script
    process.stdout.on("data", (dataBuf) => {
      const dataTxt = dataBuf.toString("utf8");
      if (dataTxt.includes(URL_FIELD)) {
        resolve(dataTxt);
      }
    });
    process.stderr.on("data", (errorBuf) => {
      const errorTxt = errorBuf.toString("utf8");
      reject(errorTxt);
    });
  });
};

module.exports = {
  parseMessage,
  constructReply,
  generateAcceptValue,
  runBuild,
};
