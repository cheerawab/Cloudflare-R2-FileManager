
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// User provided credentials
const accountId = '5f00811ec43d757ac0f57e31019e1583';
const accessKeyId = '5f00811ec43d757ac0f57e31019e1583'; // User said this is ID, but it matches Account ID
const secretAccessKey = 'gg3QvICdjpwsu0tZs3qWUi2WN0SWue4vrcOdboMK';

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    }
});

(async () => {
    console.log("Testing credentials...");
    console.log(`Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
    console.log(`AccessKeyId: ${accessKeyId}`);
    console.log(`SecretAccessKey: ${secretAccessKey.substring(0, 5)}...`);

    try {
        const data = await client.send(new ListBucketsCommand({}));
        console.log("Success! Buckets:", data.Buckets);
    } catch (err) {
        console.error("Connection Failed!");
        console.error("Error Code:", err.Code);
        console.error("Error Message:", err.message);
        if (err.Code === 'Unauthorized' || err.httpStatusCode === 403) {
            console.log("\nPOSSIBLE CAUSE: The Access Key ID might be incorrect. It looks identical to your Account ID. R2 Access Key IDs are usually different generated strings.");
        }
    }
})();
