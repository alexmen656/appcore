Notes form testing:
Files must be called Fastfile and Snapfile not Fastfile.txt - Important

we need much better docs for snapshot files etc - how to add them 


-- I need to cahnge how account are handled maybe same as ASC so a team with account, wehn new account is created we create a team + teamm owners account 


Big issues:
If an app has a min deployment target like ios 26 and iphone 16 pro as device in config our screenshots pipeline failes since we don't have an iphone 16pro with ios26 just one with 18.5 but we have 17 pro with ios26

So solution would be to have all devices with newest ios


dont start build process when certificates are missing