const { parseRepositoryConfig, findRepoConfig, validateWebhookSecret, shouldNotify, extractStageName, getDeployLink } = require('../src/utils/repo-config');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

function runTests() {
    console.log('='.repeat(60));
    console.log('Repository Config - Test Suite');
    console.log('='.repeat(60));
    console.log('');

    let passed = 0;
    let failed = 0;

    const tests = [
        {
            name: 'Parse array format config',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111', secret: 'secret1', style: 'card' },
                    { projectId: 456, chatId: '-100222', secret: 'secret2', style: 'tree' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                assert(repos.size === 2, `Expected 2 repos, got ${repos.size}`);
                assert(repos.has('id:123'), 'Should have repo by ID');
                assert(repos.has('id:456'), 'Should have repo by ID');
            },
        },
        {
            name: 'Parse object format config',
            run: () => {
                const envConfig = JSON.stringify({
                    '456': { chatId: '-100333', secret: 'secret3', style: 'minimal' },
                    '789': { chatId: '-100444' },
                });
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                assert(repos.size === 2, `Expected 2 repos, got ${repos.size}`);
                assert(repos.has('id:456'), 'Should have repo by ID');
                assert(repos.has('id:789'), 'Should have repo by ID');
            },
        },
        {
            name: 'Fallback to single-repo config when no REPOSITORY_CONFIG',
            run: () => {
                const repos = parseRepositoryConfig(null, '-100555', 'fallback-secret', 'card');
                assert(repos.size === 1, `Expected 1 repo (fallback), got ${repos.size}`);
                assert(repos.has('fallback'), 'Should have fallback key');
                const fallback = repos.get('fallback');
                assert(fallback.chatId === '-100555', 'Should use fallback chatId');
                assert(fallback.secret === 'fallback-secret', 'Should use fallback secret');
            },
        },
        {
            name: 'Find repo config by projectId',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                    { projectId: 456, chatId: '-100222' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const payload = { project: { id: 456 } };
                const config = findRepoConfig(repos, payload);
                assert(config !== null, 'Should find config');
                assert(config.chatId === '-100222', `Expected chatId -100222, got ${config.chatId}`);
            },
        },
        {
            name: 'Fallback to default config when no match',
            run: () => {
                const repos = parseRepositoryConfig(null, '-100999', 'fallback', 'card');
                const payload = { project: { id: 999 } };
                const config = findRepoConfig(repos, payload);
                assert(config !== null, 'Should find fallback config');
                assert(config.chatId === '-100999', `Expected fallback chatId -100999, got ${config.chatId}`);
            },
        },
        {
            name: 'Return null when no match and no fallback',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const payload = { project: { id: 999 } };
                const config = findRepoConfig(repos, payload);
                assert(config === null, 'Should return null when no match and no fallback');
            },
        },
        {
            name: 'Validate webhook secret - match',
            run: () => {
                const repoConfig = { secret: 'my-secret', chatId: '-100111' };
                assert(validateWebhookSecret(repoConfig, 'my-secret') === true, 'Should validate matching secret');
            },
        },
        {
            name: 'Validate webhook secret - mismatch',
            run: () => {
                const repoConfig = { secret: 'my-secret', chatId: '-100111' };
                assert(validateWebhookSecret(repoConfig, 'wrong-secret') === false, 'Should reject mismatching secret');
            },
        },
        {
            name: 'Validate webhook secret - no secret configured',
            run: () => {
                const repoConfig = { chatId: '-100111' };
                assert(validateWebhookSecret(repoConfig, 'anything') === true, 'Should allow when no secret configured');
            },
        },
        {
            name: 'Use repo-specific style',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111', style: 'tree' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const payload = { project: { id: 123 } };
                const config = findRepoConfig(repos, payload);
                assert(config.style === 'tree', `Expected style "tree", got "${config.style}"`);
            },
        },
        {
            name: 'Use default style when not specified',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'minimal');
                const payload = { project: { id: 123 } };
                const config = findRepoConfig(repos, payload);
                assert(config.style === 'minimal', `Expected style "minimal", got "${config.style}"`);
            },
        },
        {
            name: 'Skip entries missing projectId',
            run: () => {
                const envConfig = JSON.stringify([
                    { chatId: '-100111' },
                    { projectId: 123, chatId: '-100222' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                assert(repos.size === 1, `Expected 1 repo (skipped invalid), got ${repos.size}`);
                assert(repos.has('id:123'), 'Should only have valid entry');
            },
        },
        {
            name: 'Skip entries missing chatId',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123 },
                    { projectId: 456, chatId: '-100222' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                assert(repos.size === 1, `Expected 1 repo (skipped invalid), got ${repos.size}`);
                assert(repos.has('id:456'), 'Should only have valid entry');
            },
        },
        {
            name: 'Parse projectName from config',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111', projectName: 'My Custom API' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.projectName === 'My Custom API', `Expected projectName "My Custom API", got "${config.projectName}"`);
            },
        },
        {
            name: 'projectName defaults to null when not specified',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.projectName === null, `Expected projectName null, got "${config.projectName}"`);
            },
        },
        {
            name: 'Parse notifyRules from config',
            run: () => {
                const envConfig = JSON.stringify([
                    {
                        projectId: 123,
                        chatId: '-100111',
                        notifyRules: {
                            build: { send: ['success', 'failed'], ignore: ['canceled'] },
                            deploy: { send: ['success'], ignore: [] }
                        }
                    },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.notifyRules !== null, 'Should have notifyRules');
                assert(config.notifyRules.build.send.includes('success'), 'Should have build.send with success');
                assert(config.notifyRules.deploy.send.includes('success'), 'Should have deploy.send with success');
            },
        },
        {
            name: 'notifyRules defaults to null when not specified',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.notifyRules === null, `Expected notifyRules null, got "${config.notifyRules}"`);
            },
        },
        {
            name: 'Parse deployLinks from config',
            run: () => {
                const envConfig = JSON.stringify([
                    {
                        projectId: 123,
                        chatId: '-100111',
                        deployLinks: {
                            deploy: { url: 'https://example.com', name: 'Open Site' }
                        }
                    },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.deployLinks !== null, 'Should have deployLinks');
                assert(config.deployLinks.deploy.url === 'https://example.com', 'Should have deploy URL');
                assert(config.deployLinks.deploy.name === 'Open Site', 'Should have deploy name');
            },
        },
        {
            name: 'deployLinks defaults to null when not specified',
            run: () => {
                const envConfig = JSON.stringify([
                    { projectId: 123, chatId: '-100111' },
                ]);
                const repos = parseRepositoryConfig(envConfig, null, null, 'card');
                const config = repos.get('id:123');
                assert(config.deployLinks === null, `Expected deployLinks null, got "${config.deployLinks}"`);
            },
        },
        {
            name: 'shouldNotify returns true when no notifyRules',
            run: () => {
                const repoConfig = { chatId: '-100111', notifyRules: null };
                const payload = { object_attributes: { status: 'success', stages: ['build'] } };
                assert(shouldNotify(repoConfig, payload) === true, 'Should notify when no notifyRules');
            },
        },
        {
            name: 'shouldNotify returns true when stage not in notifyRules',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: ['success'], ignore: [] }
                    }
                };
                const payload = { object_attributes: { status: 'success', stages: ['deploy'] } };
                assert(shouldNotify(repoConfig, payload) === true, 'Should notify when stage not in rules');
            },
        },
        {
            name: 'shouldNotify returns true when status in send list',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: ['success', 'failed'], ignore: [] }
                    }
                };
                const payload = { object_attributes: { status: 'success', detailed_status: { context: 'build' } } };
                assert(shouldNotify(repoConfig, payload) === true, 'Should notify when status in send list');
            },
        },
        {
            name: 'shouldNotify returns false when status not in send list',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: ['success'], ignore: [] }
                    }
                };
                const payload = { object_attributes: { status: 'running', detailed_status: { context: 'build' } } };
                assert(shouldNotify(repoConfig, payload) === false, 'Should not notify when status not in send list');
            },
        },
        {
            name: 'shouldNotify returns false when status in ignore list',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: [], ignore: ['canceled', 'pending'] }
                    }
                };
                const payload = { object_attributes: { status: 'canceled', detailed_status: { context: 'build' } } };
                assert(shouldNotify(repoConfig, payload) === false, 'Should not notify when status in ignore list');
            },
        },
        {
            name: 'shouldNotify: send takes priority over ignore',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: ['success', 'failed'], ignore: ['failed'] }
                    }
                };
                const payload = { object_attributes: { status: 'failed', detailed_status: { context: 'build' } } };
                assert(shouldNotify(repoConfig, payload) === true, 'Send should take priority over ignore');
            },
        },
        {
            name: 'shouldNotify with empty send list and no ignore allows all',
            run: () => {
                const repoConfig = {
                    chatId: '-100111',
                    notifyRules: {
                        build: { send: [], ignore: [] }
                    }
                };
                const payload = { object_attributes: { status: 'success', detailed_status: { context: 'build' } } };
                assert(shouldNotify(repoConfig, payload) === true, 'Should notify with empty send and ignore');
            },
        },
        {
            name: 'extractStageName uses detailed_status.context',
            run: () => {
                const payload = { object_attributes: { detailed_status: { context: 'deploy' } } };
                assert(extractStageName(payload) === 'deploy', 'Should extract from detailed_status.context');
            },
        },
        {
            name: 'extractStageName falls back to first stage',
            run: () => {
                const payload = { object_attributes: { stages: ['test', 'deploy'] } };
                assert(extractStageName(payload) === 'test', 'Should fall back to first stage');
            },
        },
        {
            name: 'extractStageName returns "unknown" when no stage info',
            run: () => {
                const payload = { object_attributes: {} };
                assert(extractStageName(payload) === 'unknown', 'Should return "unknown"');
            },
        },
        {
            name: 'extractStageName uses builds array when available',
            run: () => {
                const payload = {
                    object_attributes: { status: 'running', detailed_status: { context: 'build' }, stages: ['build', 'deploy'] },
                    builds: [
                        { stage: 'build', status: 'success' },
                        { stage: 'deploy', status: 'running' },
                    ],
                };
                assert(extractStageName(payload) === 'deploy', 'Should extract stage from builds array matching current status');
            },
        },
        {
            name: 'getDeployLink returns link for matching stage',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: { url: 'https://example.com', name: 'Open Site' }
                    }
                };
                const link = getDeployLink(repoConfig, 'deploy', null, 'success');
                assert(link !== null, 'Should return link');
                assert(link.url === 'https://example.com', 'Should have correct URL');
                assert(link.name === 'Open Site', 'Should have correct name');
            },
        },
        {
            name: 'getDeployLink returns null for non-matching stage',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: { url: 'https://example.com', name: 'Open Site' }
                    }
                };
                const link = getDeployLink(repoConfig, 'build', null, 'success');
                assert(link === null, 'Should return null for non-matching stage');
            },
        },
        {
            name: 'getDeployLink returns null when no deployLinks',
            run: () => {
                const repoConfig = { chatId: '-100111' };
                const link = getDeployLink(repoConfig, 'deploy', null, 'success');
                assert(link === null, 'Should return null when no deployLinks');
            },
        },
        {
            name: 'getDeployLink returns link for matching branch (array format)',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: [
                            { branch: 'main',    url: 'https://prod.example.com', name: 'Production' },
                            { branch: 'develop', url: 'https://dev.example.com',  name: 'Development' },
                        ]
                    }
                };
                const link = getDeployLink(repoConfig, 'deploy', 'develop', 'success');
                assert(link !== null, 'Should return link for matching branch');
                assert(link.url === 'https://dev.example.com', 'Should return correct branch URL');
                assert(link.name === 'Development', 'Should return correct branch name');
            },
        },
        {
            name: 'getDeployLink returns null for non-matching branch (array format)',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: [
                            { branch: 'main', url: 'https://prod.example.com', name: 'Production' },
                        ]
                    }
                };
                const link = getDeployLink(repoConfig, 'deploy', 'feature/foo', 'success');
                assert(link === null, 'Should return null when no branch matches');
            },
        },
        {
            name: 'getDeployLink returns null when no branch provided for array format',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: [
                            { branch: 'main', url: 'https://prod.example.com', name: 'Production' },
                        ]
                    }
                };
                const link = getDeployLink(repoConfig, 'deploy', null, 'success');
                assert(link === null, 'Should return null when branch is not provided');
            },
        },
        {
            name: 'getDeployLink returns null when status is not success',
            run: () => {
                const repoConfig = {
                    deployLinks: {
                        deploy: { url: 'https://example.com', name: 'Open Site' }
                    }
                };
                const linkRunning = getDeployLink(repoConfig, 'deploy', null, 'running');
                const linkFailed = getDeployLink(repoConfig, 'deploy', null, 'failed');
                const linkCanceled = getDeployLink(repoConfig, 'deploy', null, 'canceled');
                assert(linkRunning === null, 'Should return null for running status');
                assert(linkFailed === null, 'Should return null for failed status');
                assert(linkCanceled === null, 'Should return null for canceled status');
            },
        },
    ];

    for (const test of tests) {
        process.stdout.write(`Testing: ${test.name}... `);

        try {
            test.run();
            console.log('PASS');
            passed++;
        } catch (err) {
            console.log(`FAIL: ${err.message}`);
            failed++;
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
