import { ArrowUpRight, CalendarDays, Clock3, UsersRound, MapPin } from "lucide-react";
import { Link } from "react-router";
import { dateParts, seats, type EventSummary } from "../model";

export function EventCards({ events }: { events: EventSummary[] }) {
  return (
    <div className="card-grid">
      {events.map((event) => {
        const date = dateParts(event.starts_at);
        return (
          <Link className="event-card" key={event.id} to={"/events/" + event.id}>
            <div className="card-picture">
              <img src={`/events/${event.id}/cover`} alt="" />
              <span className="event-category">
                <span />
                {event.category}
              </span>
              <span className="card-open">
                <ArrowUpRight size={17} />
              </span>
            </div>
            <div className="card-body">
              <p className="card-date">
                <CalendarDays size={14} />
                {date.date}
                <i /> <Clock3 size={14} />
                {date.time}
              </p>
              <h3>{event.title}</h3>
              {event.location && (
                <p className="card-place">
                  <MapPin size={15} />
                  {event.location}
                </p>
              )}
              <div className="card-bottom">
                <UsersRound size={15} />
                {event.remaining ? seats(event.remaining) + " вільно" : "Місць немає"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
