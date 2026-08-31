module.exports = {
  testEnvironment: "jest-environment-jsdom",
  testEnvironmentOptions: { url: "http://localhost/" },
  testMatch: ["<rootDir>/tests/**/*.test.js"]
};
