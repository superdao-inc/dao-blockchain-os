module.exports = {
    skipFiles: [
        "libraries",
        "mock/",
        "kernel/interfaces",
        "apps/AdminController/AdminController.sol",
        "oracle/",
        "templates/DAOConstructor.sol"
    ],
    istanbulReporter: ['json', 'cobertura', 'text', 'html', 'text-summary']
};
