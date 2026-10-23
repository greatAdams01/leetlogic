import { checkMediaConfiguration } from "./services/storage/private-media.js";
import { AppError } from "./lib/errors.js";
try {
  console.log(JSON.stringify(await checkMediaConfiguration()));
} catch (error) {
  if (error instanceof AppError)
    console.error(JSON.stringify({ code: error.code, ...error.diagnostics }));
  else
    console.error(
      JSON.stringify({ code: "MEDIA_CHECK_FAILED", hint: "Check server configuration and retry." }),
    );
  process.exitCode = 1;
}
