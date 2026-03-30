Notes form testing:
Files must be called Fastfile and Snapfile not Fastfile.txt - Important

we need much better docs for snapshot files etc - how to add them 


-- I need to cahnge how account are handled maybe same as ASC so a team with account, wehn new account is created we create a team + teamm owners account 


Big issues:
If an app has a min deployment target like ios 26 and iphone 16 pro as device in config our screenshots pipeline failes since we don't have an iphone 16pro with ios26 just one with 18.5 but we have 17 pro with ios26

So solution would be to have all devices with newest ios


dont start build process when certificates are missing

fastlane is broken it makes ios 26.3.1 to 26.3 whoch dont matches our simulators


This is summarized by Claude:

## Fastlane local patches (re-apply after `fastlane update_fastlane`)

All patches apply to both the dev machine (`2.232.0`) and the Mac Mini worker (`2.232.2`). Paths differ only in the version number.

### 1. deliver — "No data" crash on first-ever submission

**File:** `deliver/lib/deliver/upload_metadata.rb` line 688

**Change** (two lines in `review_attachment_file`):
```ruby
# before
app_store_review_detail = version.fetch_app_store_review_detail
app_store_review_attachments = app_store_review_detail.app_store_review_attachments || []

# after
app_store_review_detail = version.fetch_app_store_review_detail rescue nil
return if app_store_review_detail.nil? # first-time submission: review detail not created yet
```

**Why:** `AppStoreReviewDetail` doesn't exist yet in ASC for brand-new apps — `fetch_app_store_review_detail` raises instead of returning nil, and the next line crashes calling `.app_store_review_attachments` on nil.

---

### 2. frameit — iPhone 16 / 17 support

#### 2a. New device definitions

**File:** `frameit/lib/frameit/device_types.rb` — added after existing device list (around line 189):

```ruby
IPHONE_16         = Device.new("iphone-16",        "Apple iPhone 16",         13, [[1179, 2556], [2556, 1179]], 460, Color::BLACK,             Platform::IOS)
IPHONE_16_PLUS    = Device.new("iphone-16-plus",   "Apple iPhone 16 Plus",    13, [[1290, 2796], [2796, 1290]], 460, Color::BLACK,             Platform::IOS)
IPHONE_16_PRO     = Device.new("iphone-16-pro",    "Apple iPhone 16 Pro",     13, [[1206, 2622], [2622, 1206]], 460, Color::NATURAL_TITANIUM,  Platform::IOS, DEVICE_SCREEN_IDS[DisplayType::APP_IPHONE_61])
IPHONE_16_PRO_MAX = Device.new("iphone16-pro-max", "Apple iPhone 16 Pro Max", 13, [[1320, 2868], [2868, 1320]], 460, Color::NATURAL_TITANIUM,  Platform::IOS, DEVICE_SCREEN_IDS[DisplayType::APP_IPHONE_67])
```

Also add the `NATURAL_TITANIUM` color constant to the `Color` module (line ~94):
```ruby
NATURAL_TITANIUM = "Natural Titanium"
```

#### 2b. Rounded corner masking for iPhone 16 / 17

**File:** `frameit/lib/frameit/editor.rb` — extend the existing iPhone 14 rounded-corner condition:

```ruby
# before
if screenshot.device.id.to_s.include?("iphone-14") || screenshot.device.id.to_s.include?("iphone14")
# after
if screenshot.device.id.to_s.include?("iphone-14") || screenshot.device.id.to_s.include?("iphone14") ||
   screenshot.device.id.to_s.include?("iphone-16") || screenshot.device.id.to_s.include?("iphone16") ||
   screenshot.device.id.to_s.include?("iphone-17") || screenshot.device.id.to_s.include?("iphone17")
```

#### 2c. Device frame images

Add the PNG frame files to `~/.fastlane/frameit/latest/` on each machine:
- `Apple iPhone 16 Black.png`
- `Apple iPhone 16 Plus Black.png`
- `Apple iPhone 16 Pro Natural Titanium.png`
- `Apple iPhone 16 Pro Max Natural Titanium.png`

These are downloaded automatically by `fastlane frameit` on first run, but may need to be copied manually between machines if offline.




notes:
we need to disable mac minis 1 minute auto sleep