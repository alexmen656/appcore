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

### 1b. deliver — undefined `app_store_review_attachments` (fastlane 2.232.2 regression)

**File:** `deliver/lib/deliver/upload_metadata.rb` line ~690 (method `review_attachment_file`)

In 2.232.2 the local variable `app_store_review_attachments` is referenced but never assigned, so every metadata upload crashes with `NameError: undefined local variable or method 'app_store_review_attachments'`.

**Change:** After the `return if app_store_review_detail.nil?` line, add:
```ruby
app_store_review_attachments = (app_store_review_detail.fetch_app_store_review_attachments rescue []) || []
```

Backup kept as `upload_metadata.rb.bak` on the Mac Mini worker.

**Why:** Upstream fastlane bug — the previously-existing assignment was removed but the `.each` call below still references the variable. Fetching attachments via the review detail restores the original behavior.

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






Binary build was skipped or failed (non-fatal, screenshots continue)
Saved 15 screenshot(s) from worker to /home/ubuntu/appcore/screenshots/cmndfj2ft0001oictn8nnh7xw
Generating AI sublines for 20 screen(s)...
AI sublines generated for 2 locale(s)
Auto-framing failed (non-fatal): Worker frameit failed: fastlane frameit failed (code 1).
Top level ::CompositeIO is deprecated, require 'multipart/post' and use `Multipart::Post::CompositeReadIO` instead!
Top level ::Parts is deprecated, require 'multipart/post' and use `Multipart::Post::Parts` instead!
[19:00:49]: [33mGet started using a Gemfile for fastlane https://docs.fastlane.tools/getting-started/ios/setup/#use-a-gemfile[0m
[19:00:49]: #############################################################
[19:00:49]: # You have to install the ImageMagick to use FrameIt
[19:00:49]: # Install it using 'brew update && brew install imagemagick'
[19:00:49]: # If you don't have homebrew: http://brew.sh
[19:00:49]: #############################################################
/opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/fastlane_core/lib/fastlane_core/ui/interface.rb:141:in 'FastlaneCore::Interface#user_error!': Install ImageMagick and start frameit again! (FastlaneCore::Interface::FastlaneError)
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/fastlane_core/lib/fastlane_core/ui/ui.rb:17:in 'FastlaneCore::UI.method_missing'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/frameit/lib/frameit/dependency_checker.rb:18:in 'Frameit::DependencyChecker.check_image_magick'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/frameit/lib/frameit/dependency_checker.rb:8:in 'Frameit::DependencyChecker.check_dependencies'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/frameit/lib/frameit/commands_generator.rb:20:in 'Frameit::CommandsGenerator.start'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/fastlane/lib/fastlane/cli_tools_distributor.rb:124:in 'Fastlane::CLIToolsDistributor.take_off'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/gems/fastlane-2.232.2/bin/fastlane:23:in '<top (required)>'
	from /opt/homebrew/Cellar/ruby/4.0.2/lib/ruby/4.0.0/rubygems.rb:304:in 'Kernel#load'
	from /opt/homebrew/Cellar/ruby/4.0.2/lib/ruby/4.0.0/rubygems.rb:304:in 'Gem.activate_and_load_bin_path'
	from /opt/homebrew/Cellar/fastlane/2.232.2/libexec/bin/fastlane:25:in '<main>'


## important
setup dhcp lease

## Credits
Design partly inspired by RevenueCat