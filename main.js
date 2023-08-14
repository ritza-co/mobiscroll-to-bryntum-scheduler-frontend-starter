import "./style.css";
import client from "./utils/fetchWrapper";

mobiscroll.setOptions({
  theme: "ios",
  themeVariant: "light",
});

mobiscroll.momentTimezone.moment = moment;

var popup,
  range,
  oldEvent,
  tempEvent = {},
  deleteEvent,
  restoreEvent,
  titleInput = document.getElementById("event-title"),
  deleteButton = document.getElementById("event-delete"),
  datePickerResponsive = {
    medium: {
      controls: ["calendar"],
      touchUi: false,
    },
  },
  datetimePickerResponsive = {
    medium: {
      controls: ["calendar", "time"],
      touchUi: false,
    },
  };

function createAddPopup(el) {
  // hide delete button inside add popup
  deleteButton.style.display = "none";

  deleteEvent = true;
  restoreEvent = false;

  // set popup header text and buttons for adding
  popup.setOptions({
    headerText: "New event",
    buttons: [
      "cancel",
      {
        text: "Add",
        keyCode: "enter",
        handler: function () {
          calendar.updateEvent(tempEvent);
          deleteEvent = false;
          // navigate the calendar to the correct view
          calendar.navigateToEvent(tempEvent);
          popup.close();
          client("http://localhost:1338/data/event-add", {
            body: tempEvent,
          }).then(
            (data) => {
              const { id, ...rest } = tempEvent;
              calendar.removeEvent(tempEvent);
              calendar.addEvent({ id: data.id, ...rest });
            },
            (error) => {
              console.error("Create event failed", error);
            }
          );
        },
        cssClass: "mbsc-popup-button-primary",
      },
    ],
  });

  // fill popup with a new event data
  mobiscroll.getInst(titleInput).value = tempEvent.title;
  range.setVal([tempEvent.start, tempEvent.end]);
  range.setOptions({
    controls: ["datetime"],
    responsive: datetimePickerResponsive,
  });

  // set anchor for the popup
  popup.setOptions({ anchor: el });

  popup.open();
}

function createEditPopup(args) {
  var ev = args.event;

  // show delete button inside edit popup
  deleteButton.style.display = "block";

  deleteEvent = false;
  restoreEvent = true;

  // set popup header text and buttons for editing
  popup.setOptions({
    headerText: "Edit event",
    buttons: [
      "cancel",
      {
        text: "Save",
        keyCode: "enter",
        handler: function () {
          var date = range.getVal();
          var eventToSave = {
            title: titleInput.value,
            start: date[0],
            end: date[1],
            resource: ev.resource,
          };
          // update event with the new properties on save button click
          calendar.updateEvent(eventToSave);
          client(`http://localhost:1338/data/event-update/${ev.id}`, {
            body: eventToSave,
          }).then(
            (data) => {
              console.log("Update event response", data);
            },
            (error) => {
              console.error("Update event failed", error);
            }
          );
          // navigate the calendar to the correct view
          calendar.navigateToEvent(eventToSave);
          restoreEvent = false;
          popup.close();
        },
        cssClass: "mbsc-popup-button-primary",
      },
    ],
  });

  // fill popup with the selected event data
  mobiscroll.getInst(titleInput).value = ev.title || "";
  range.setVal([ev.start, ev.end]);

  range.setOptions({
    controls: ["datetime"],
    responsive: datetimePickerResponsive,
  });

  // set anchor for the popup
  popup.setOptions({ anchor: args.domEvent.currentTarget });
  popup.open();
}

const calendar = mobiscroll.eventcalendar("#eventcalendar", {
  clickToCreate: "double",
  dragToCreate: true,
  dragToMove: true,
  dragToResize: true,
  timezonePlugin: mobiscroll.momentTimezone,
  dataTimezone: "utc",
  displayTimezone: "utc",
  view: {
    timeline: { type: "week" },
  },
  selectedDate: new Date(2023, 6, 25),
  onEventClick: function (args) {
    oldEvent = Object.assign({}, args.event);
    tempEvent = args.event;

    if (!popup.isVisible()) {
      createEditPopup(args);
    }
  },
  onEventCreated: function (args) {
    popup.close();
    // store temporary event
    tempEvent = args.event;
    createAddPopup(args.target);
  },
  onEventDeleted: function (args) {
    mobiscroll.snackbar({
      button: {
        action: function () {
          calendar.addEvent(args.event);
        },
        text: "Undo",
      },
      message: "Event deleted",
    });
  },
  onEventDragEnd: function ({ event }) {
    const id = `${event.id}`;
    // scroll create - has not been saved to db. Will be saved when "save" in popup modal is clicked
    if (id.startsWith("mbsc")) {
      return;
    }
    client(`http://localhost:1338/data/event-update/${id}`, {
      body: event,
    }).then(
      (data) => {
        console.log("Update event response", data);
      },
      (error) => {
        console.error("Update event failed", error);
      }
    );
  },
});

mobiscroll.util.http.getJson(
  "http://localhost:1338/data",
  function (events) {
    calendar.setEvents(events.events);
    mobiscroll.setOptions({ resources: events.resources })
  },
  "json"
);

popup = mobiscroll.popup("#demo-add-popup", {
  display: "bottom",
  contentPadding: false,
  fullScreen: true,
  onClose: function () {
    if (deleteEvent) {
      const id = `${tempEvent.id}`;
      calendar.removeEvent(tempEvent);
      if (id.startsWith("mbsc")) {
        return;
      }
      client(`http://localhost:1338/data/event-delete/${id}`, {
        body: tempEvent,
      }).then(
        (data) => {
          console.log("Delete event response", data);
        },
        (error) => {
          console.error("Delete event failed", error);
        }
      );
    } else if (restoreEvent) {
      calendar.updateEvent(oldEvent);
      client(`http://localhost:1338/data/event-update/${oldEvent.id}`, {
        body: oldEvent,
      }).then(
        (data) => {
          console.log("Update event response", data);
        },
        (error) => {
          console.error("Update event failed", error);
        }
      );
    }
  },
  responsive: {
    medium: {
      display: "anchored",
      width: 400,
      fullScreen: false,
      touchUi: false,
    },
  },
});

titleInput.addEventListener("input", function (ev) {
  // update current event's title
  tempEvent.title = ev.target.value;
});

range = mobiscroll.datepicker("#event-date", {
  controls: ["date"],
  select: "range",
  startInput: "#start-input",
  endInput: "#end-input",
  showRangeLabels: false,
  touchUi: true,
  responsive: datePickerResponsive,
  onChange: function (args) {
    var date = args.value;
    // update event's start date
    tempEvent.start = date[0];
    tempEvent.end = date[1];
  },
});

deleteButton.addEventListener("click", function () {
  // delete current event on button click
  calendar.removeEvent(tempEvent);
  client(`http://localhost:1338/data/event-delete/${tempEvent.id}`, {
    body: tempEvent,
  }).then(
    (data) => {
      console.log("Delete event response", data);
    },
    (error) => {
      console.error("Delete event failed", error);
    }
  );
  popup.close();

  // save a local reference to the deleted event
  var deletedEvent = tempEvent;

  mobiscroll.snackbar({
    button: {
      action: function () {
        calendar.addEvent(deletedEvent);
      },
      text: "Undo",
    },
    message: "Event deleted",
  });
});
