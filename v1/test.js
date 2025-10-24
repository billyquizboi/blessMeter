
// example simple send of an event

// const emulated = new CustomEvent("onEventReceived", {
//     detail: {
//       "listener": "message",
//       event: {
//         data: {
//           text: "Example message!",
//           displayName: "StreamElements"
//         }
//       }
//     }
//   });
//   window.dispatchEvent(emulated);

const blurseTheRun = "Blurse the run";
const blessTheRun = "Bless the run";
const curseTheRun = "Curse the run";

function testMeters() {
    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blessTheRun));
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(curseTheRun));
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blurseTheRun));
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blessTheRun));
        window.dispatchEvent(mockRedeemEvent(curseTheRun));
        window.dispatchEvent(mockRedeemEvent(blurseTheRun));
    }
}


function mockRedeemEvent(redemptionName) {
    return new CustomEvent("onEventReceived", {
        detail: {
            event: {
                itemId: redemptionName
            }
        }
    });
}