## Install

```bash
yarn install
```

## Run

### Get URLs

Run the below, passing your Stitcher user ID as the first argument, and the feed ID as the second argument:

```bash
yarn start 1234567890 98765
```

This will write a file named like `98765.txt`, containing a list of URLs for each episode. You can then import the URLs into the download manager of your choice, such as [uGet](https://ugetdm.com/).

This will also save the feed's XML file, for use in later organising the downloaded files.

### Organise MP3s

Run the below, passing the feed ID and the directory containing the downloaded MP3s:

```bash
yarn organise 98765 "C:\Users\Me\Downloads\Comedy Bang Bang"
```

This will tag and rename the files.

If you only want to tag the files, pass `--tag`. Likewise, to only rename the files, pass `--rename`.

Once files are renamed, they can't be re-tagged.

## FAQ

### How do I find a feed ID?

- Log in to the Stitcher web player at https://app.stitcher.com
- Browse to the show

In the URL bar, you'll see an address like `https://app.stitcher.com/browse/feed/98765/details`. In this example, `98765` is the feed ID.

If the address looks like `https://app.stitcher.com/browse/16/890519/514917/details`, then `514917` is the feed ID.


### How do I find my Stitcher user ID?

To find out your Stitcher user ID:

- Log in to the Stitcher web player at https://app.stitcher.com
- Go to https://app.stitcher.com/Service/GetSubscriptionStatus.php
- In the `subscriptionStatus` element, look for the `uid` attribute. Its value is your user ID.
