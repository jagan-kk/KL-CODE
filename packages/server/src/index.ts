import {Hono} from 'hono'
import { HTTPException } from 'hono/http-exception';
import sessions from "./routes/session"
import { sentry } from "@sentry/hono/bun";
import * as Sentry from "@sentry/hono/bun";
import chat from "./routes/chat"
import undo from "./routes/undo"

const app =new Hono()

app.use(
  sentry(app, {
    dsn: "https://89af7d2853ec8c8d3af2d1faf686c95a@o4511614943232000.ingest.us.sentry.io/4511614955552768",
    tracesSampleRate: 1.0,
    enableLogs: true,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  }),
);

app.get("/debug-sentry", () => {
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);
  throw new Error("My first Sentry error!");
});



app.onError((error,c) => {
    if(error instanceof HTTPException) {

        Sentry.logger.warn("Handle HTTP error", {
            status: error.status,
            messsage:error.message || "Request failed",
            path: c.req.path,
            method: c.req.method
        })
        return c.json ({
            error: error.message || "Request failed",

        },error.status)
    }

    Sentry.logger.error("unhandled server error", {
        path:c.req.path,
        method: c.req.method,
        message: error instanceof Error ? error.message :"unknown error",
    });



    return c.json({error: "Internal server error"},500);
});

const routes = app.route("/sessions",sessions).route("/chat",chat).route("/undo",undo);

export type AppType = typeof routes

export default {port:3000,fetch:app.fetch,idleTimeout:255}