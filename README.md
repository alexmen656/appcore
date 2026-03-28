Notes form testing:
Files must be called Fastfile and Snapfile not Fastfile.txt - Important

we need much better docs for snapshot files etc - how to add them 


-- I need to cahnge how account are handled maybe same as ASC so a team with account, wehn new account is created we create a team + teamm owners account 


Big issues:
If an app has a min deployment target like ios 26 and iphone 16 pro as device in config our screenshots pipeline failes since we don't have an iphone 16pro with ios26 just one with 18.5 but we have 17 pro with ios26

So solution would be to have all devices with newest ios


dont start build process when certificates are missing

fastlane is broken it makes ios 26.3.1 to 26.3 whoch dont matches our simulators

fastlane deliver crashes with "No data" on first-ever app submission because AppStoreReviewDetail doesn't exist yet in ASC and fetch_app_store_review_detail raises instead of returning nil. Patched locally: change line 688 in `/opt/homebrew/Cellar/fastlane/2.232.0/libexec/gems/fastlane-2.232.0/deliver/lib/deliver/upload_metadata.rb` to `app_store_review_detail = version.fetch_app_store_review_detail rescue nil`. Re-apply after `fastlane update_fastlane`.