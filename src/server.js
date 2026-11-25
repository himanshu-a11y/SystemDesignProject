const { createApp, createDefaultRepository } = require("./app");

const PORT = process.env.PORT || 3000;
const app = createApp(createDefaultRepository());

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
