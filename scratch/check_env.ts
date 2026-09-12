// scratch/check_env.ts
console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "EXISTS (starts with " + process.env.OPENROUTER_API_KEY.slice(0, 8) + ")" : "UNDEFINED");
console.log("OPENROUTER_MODEL:", process.env.OPENROUTER_MODEL);
