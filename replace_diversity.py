with open("app/page.tsx", "r", encoding="utf8") as f:
    content = f.read()

# The exact old string (with proper escaping)
old = """  // Image + video cards: exactly 480 × 270 (16:9), equal size, aligned on the
  // same bottom line (marginTop auto pins both to the bottom of the columns).
  diversityImageContainer: {
    width: "100%",
    height: "auto",
    aspectRatio: "16 / 9",
    marginTop: "auto",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  diversityImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  diversityVideoContainer: {
    width: "100%",
    height: "auto",
    aspectRatio: "16 / 9",
    marginTop: "auto",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  diversityVideo: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    autoPlay,
    muted,
    loop,
    playsInline,
  },
  diversityBadge: {
    padding: "10px 18px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "20px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#007AFF",
    boxShadow: "var(--card-shadow)",
    display: "inline-block",
  },"""

new = """  // Main frame — 90% of card height, both image and video must be identical in size/position
  diversityMainFrame: {
    width: "100%",
    height: "90%",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "var(--card-shadow)",
  },
  diversityImageContainer: {
    width: "100%",
    height: "100%",
    borderRadius: "24px",
    objectFit: "cover",
  },
  diversityImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  diversityVideoContainer: {
    width: "100%",
    height: "100%",
    borderRadius: "24px",
    objectFit: "cover",
  },
  diversityVideo: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    autoPlay,
    muted,
    loop,
    playsInline,
  },
  diversityBadge: {
    padding: "10px 18px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "20px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#007AFF",
    boxShadow: "var(--card-shadow)",
    display: "inline-block",
  },"""

if old in content:
    content = content.replace(old, new)
    with open("app/page.tsx", "w", encoding="utf8") as f:
        f.write(content)
    print("Replacement successful")
    print("New length:", len(content))
else:
    print("Old string NOT found")
    # Let's find what's actually at that location
    idx = content.find('diversityImageContainer')
    if idx >= 0:
        print("Found at index:", idx)
        print("Context:", repr(content[idx-50:idx+100]))