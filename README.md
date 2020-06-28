Install:

```bash
yarn install
```

Run, passing your Stitcher user ID as the first arg:

```bash
yarn --silent start 1234567890 > urls.txt
```

To find out your Stitcher user ID:

- Log in to the Stitcher web player at https://app.stitcher.com
- Go to https://app.stitcher.com/Service/GetSubscriptionStatus.php
- In the `subscriptionStatus` element, look for the `uid` attribute. Its value is your user ID.
