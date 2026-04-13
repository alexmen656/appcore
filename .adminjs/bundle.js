(function (React, adminjs, designSystem) {
  'use strict';

  function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

  var React__default = /*#__PURE__*/_interopDefault(React);

  const api = new adminjs.ApiClient();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function statusColor(s) {
    const m = {
      PENDING: "warning",
      RUNNING: "info",
      COMPLETED: "success",
      FAILED: "danger",
      APPROVED: "info",
      APPLIED: "success",
      REJECTED: "default",
      DEPLOYED: "info",
      EVALUATED: "success"
    };
    return m[s] || "default";
  }
  function timeAgo(d) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "gerade eben";
    if (mins < 60) return `vor ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `vor ${days}d`;
    return new Date(d).toLocaleDateString("de-DE");
  }
  function trunc(s, n) {
    if (!s) return "\u2014";
    return s.length > n ? s.slice(0, n) + "\u2026" : s;
  }
  function num(n) {
    return (n || 0).toLocaleString("de-DE");
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const KPI_ITEMS = [{
    key: "apps",
    label: "Apps",
    icon: "Smartphone"
  }, {
    key: "users",
    label: "Users",
    icon: "Users"
  }, {
    key: "teams",
    label: "Teams",
    icon: "Briefcase"
  }, {
    key: "keywords",
    label: "Keywords",
    icon: "Key"
  }, {
    key: "suggestions",
    label: "Vorschlaege",
    icon: "Zap"
  }, {
    key: "experiments",
    label: "Experiments",
    icon: "GitBranch"
  }, {
    key: "screenshotJobs",
    label: "Screenshots",
    icon: "Camera"
  }, {
    key: "buildJobs",
    label: "Builds",
    icon: "Package"
  }, {
    key: "analyticsRecords",
    label: "Analytics",
    icon: "TrendingUp"
  }, {
    key: "reviews",
    label: "Reviews",
    icon: "Star"
  }];
  const QUICK_LINKS = [{
    label: "Apps",
    icon: "Smartphone",
    resource: "App"
  }, {
    label: "Keywords",
    icon: "Key",
    resource: "Keyword"
  }, {
    label: "ASO Experiments",
    icon: "GitBranch",
    resource: "AsoExperiment"
  }, {
    label: "Vorschlaege",
    icon: "Zap",
    resource: "ASOSuggestion"
  }, {
    label: "Benutzer",
    icon: "Users",
    resource: "User"
  }, {
    label: "Screenshot Jobs",
    icon: "Camera",
    resource: "ScreenshotJob"
  }, {
    label: "Build Jobs",
    icon: "Package",
    resource: "BuildJob"
  }, {
    label: "Analytics",
    icon: "TrendingUp",
    resource: "AppStoreAnalytics"
  }, {
    label: "Reviews",
    icon: "Star",
    resource: "AppReview"
  }, {
    label: "Metadaten",
    icon: "FileText",
    resource: "AppMetadataChange"
  }];

  // ---------------------------------------------------------------------------
  // Dashboard Component
  // ---------------------------------------------------------------------------
  const Dashboard = () => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
      api.getDashboard().then(res => setData(res.data)).finally(() => setLoading(false));
    }, []);
    if (loading) {
      return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        flex: true,
        flexDirection: "row",
        justifyContent: "center",
        py: "xxl"
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Loader, null));
    }
    if (!data) {
      return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        p: "xl"
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        color: "error"
      }, "Daten konnten nicht geladen werden."));
    }
    return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      p: "xl",
      maxWidth: 1200,
      mx: "auto"
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      height: 4,
      bg: "primary100",
      borderRadius: "default",
      mb: "xl"
    }), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      mb: "xl"
    }, /*#__PURE__*/React__default.default.createElement(designSystem.H2, {
      color: "primary100"
    }, "Marteso Admin"), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      variant: "sm",
      color: "grey60"
    }, "ASO Engine \u2014 Control Center")), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      flex: true,
      flexDirection: "row",
      flexWrap: "wrap",
      mb: "xl",
      style: {
        gap: 12
      }
    }, KPI_ITEMS.map(item => /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      key: item.key,
      bg: "white",
      border: "default",
      borderRadius: "default",
      p: "lg",
      style: {
        minWidth: 150,
        maxWidth: 200,
        flex: "1 1 150px"
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      flex: true,
      flexDirection: "row",
      alignItems: "center",
      mb: "sm",
      style: {
        gap: 8
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Icon, {
      icon: item.icon,
      size: 16,
      color: "grey60"
    }), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      variant: "sm",
      color: "grey60",
      fontWeight: "bold",
      textTransform: "uppercase"
    }, item.label)), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      fontSize: 28,
      fontWeight: "bold",
      color: "primary100"
    }, num(data[item.key]))))), /*#__PURE__*/React__default.default.createElement(designSystem.H5, {
      mb: "lg",
      mt: "xl"
    }, "Schnellzugriff"), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      flex: true,
      flexDirection: "row",
      flexWrap: "wrap",
      mb: "xl",
      style: {
        gap: 10
      }
    }, QUICK_LINKS.map(link => /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      key: link.resource,
      as: "a",
      href: `/admin/resources/${link.resource}`,
      flex: true,
      flexDirection: "row",
      alignItems: "center",
      bg: "white",
      border: "default",
      borderRadius: "default",
      p: "default",
      style: {
        gap: 10,
        textDecoration: "none",
        color: "#111827",
        fontSize: 13,
        fontWeight: 600,
        minWidth: 160
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Icon, {
      icon: link.icon,
      size: 16,
      color: "primary100"
    }), /*#__PURE__*/React__default.default.createElement("span", null, link.label)))), data.recentJobs?.length > 0 && /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      mb: "xl"
    }, /*#__PURE__*/React__default.default.createElement(designSystem.H5, {
      mb: "lg"
    }, "Letzte Jobs"), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      bg: "white",
      border: "default",
      borderRadius: "default",
      style: {
        overflow: "hidden"
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Table, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableHead, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Typ"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "App"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Status"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Branch / Commit"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Erstellt"))), /*#__PURE__*/React__default.default.createElement(designSystem.TableBody, null, data.recentJobs.map((j, i) => /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, {
      key: i
    }, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        fontWeight: 600
      }
    }, j._type), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, j.appName || "\u2014"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, /*#__PURE__*/React__default.default.createElement(designSystem.Badge, {
      variant: statusColor(j.status)
    }, j.status)), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        fontFamily: "monospace",
        fontSize: 12,
        color: "#8b93a5"
      }
    }, j.branch || "", j.commitSha ? ` ${j.commitSha.slice(0, 7)}` : ""), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        color: "#8b93a5",
        fontSize: 12
      }
    }, timeAgo(j.createdAt)))))))), data.recentExperiments?.length > 0 && /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      mb: "xl"
    }, /*#__PURE__*/React__default.default.createElement(designSystem.H5, {
      mb: "lg"
    }, "Letzte ASO Experiments"), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      bg: "white",
      border: "default",
      borderRadius: "default",
      style: {
        overflow: "hidden"
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Table, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableHead, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "App"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Typ"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Von / Nach"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Confidence"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Status"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Erstellt"))), /*#__PURE__*/React__default.default.createElement(designSystem.TableBody, null, data.recentExperiments.map((e, i) => {
      const conf = Math.round((e.confidence || 0) * 100);
      const cc = conf >= 80 ? "success" : conf >= 50 ? "warning" : "danger";
      return /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, {
        key: i
      }, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
        style: {
          fontWeight: 500
        }
      }, e.app?.name || "\u2014"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, (e.type || "").replace(/_/g, " ")), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        variant: "sm",
        color: "grey60",
        as: "span"
      }, trunc(e.fromValue, 18)), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        variant: "sm",
        color: "grey40",
        as: "span",
        mx: "sm"
      }, "\u2192"), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        variant: "sm",
        as: "span",
        fontWeight: "bold"
      }, trunc(e.toValue, 18))), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, /*#__PURE__*/React__default.default.createElement(designSystem.Badge, {
        variant: cc
      }, conf, "%")), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, /*#__PURE__*/React__default.default.createElement(designSystem.Badge, {
        variant: statusColor(e.status)
      }, e.status)), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
        style: {
          color: "#8b93a5",
          fontSize: 12
        }
      }, timeAgo(e.createdAt)));
    }))))), data.recentApps?.length > 0 && /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      mb: "xl"
    }, /*#__PURE__*/React__default.default.createElement(designSystem.H5, {
      mb: "lg"
    }, "Kuerzlich aktualisierte Apps"), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      bg: "white",
      border: "default",
      borderRadius: "default",
      style: {
        overflow: "hidden"
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Table, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableHead, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, null, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Name"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Bundle ID"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Land"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Eigene App"), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, "Aktualisiert"))), /*#__PURE__*/React__default.default.createElement(designSystem.TableBody, null, data.recentApps.map((a, i) => /*#__PURE__*/React__default.default.createElement(designSystem.TableRow, {
      key: i
    }, /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        fontWeight: 600
      }
    }, a.name), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        fontFamily: "monospace",
        fontSize: 12,
        color: "#8b93a5"
      }
    }, a.bundleId), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, (a.country || "\u2014").toUpperCase()), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, null, /*#__PURE__*/React__default.default.createElement(designSystem.Badge, {
      variant: a.isOwnApp ? "success" : "default"
    }, a.isOwnApp ? "Ja" : "Nein")), /*#__PURE__*/React__default.default.createElement(designSystem.TableCell, {
      style: {
        color: "#8b93a5",
        fontSize: 12
      }
    }, timeAgo(a.updatedAt)))))))), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      py: "xl",
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      variant: "sm",
      color: "grey60"
    }, "Marteso ASO Engine \u2014 Admin Dashboard")));
  };

  AdminJS.UserComponents = {};
  AdminJS.UserComponents.Dashboard = Dashboard;

})(React, AdminJS, AdminJSDesignSystem);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9hZG1pbi9zcmMvY29tcG9uZW50cy9kYXNoYm9hcmQudHN4IiwiZW50cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IEFwaUNsaWVudCB9IGZyb20gXCJhZG1pbmpzXCI7XG5pbXBvcnQge1xuICBCb3gsXG4gIEgyLFxuICBINSxcbiAgVGV4dCxcbiAgSWNvbixcbiAgTG9hZGVyLFxuICBUYWJsZSxcbiAgVGFibGVIZWFkLFxuICBUYWJsZUJvZHksXG4gIFRhYmxlUm93LFxuICBUYWJsZUNlbGwsXG4gIEJhZGdlLFxufSBmcm9tIFwiQGFkbWluanMvZGVzaWduLXN5c3RlbVwiO1xuXG5jb25zdCBhcGkgPSBuZXcgQXBpQ2xpZW50KCk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gSGVscGVyc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5mdW5jdGlvbiBzdGF0dXNDb2xvcihzOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBtOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIFBFTkRJTkc6IFwid2FybmluZ1wiLFxuICAgIFJVTk5JTkc6IFwiaW5mb1wiLFxuICAgIENPTVBMRVRFRDogXCJzdWNjZXNzXCIsXG4gICAgRkFJTEVEOiBcImRhbmdlclwiLFxuICAgIEFQUFJPVkVEOiBcImluZm9cIixcbiAgICBBUFBMSUVEOiBcInN1Y2Nlc3NcIixcbiAgICBSRUpFQ1RFRDogXCJkZWZhdWx0XCIsXG4gICAgREVQTE9ZRUQ6IFwiaW5mb1wiLFxuICAgIEVWQUxVQVRFRDogXCJzdWNjZXNzXCIsXG4gIH07XG4gIHJldHVybiBtW3NdIHx8IFwiZGVmYXVsdFwiO1xufVxuXG5mdW5jdGlvbiB0aW1lQWdvKGQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGRpZmYgPSBEYXRlLm5vdygpIC0gbmV3IERhdGUoZCkuZ2V0VGltZSgpO1xuICBjb25zdCBtaW5zID0gTWF0aC5mbG9vcihkaWZmIC8gNjAwMDApO1xuICBpZiAobWlucyA8IDEpIHJldHVybiBcImdlcmFkZSBlYmVuXCI7XG4gIGlmIChtaW5zIDwgNjApIHJldHVybiBgdm9yICR7bWluc31tYDtcbiAgY29uc3QgaG91cnMgPSBNYXRoLmZsb29yKG1pbnMgLyA2MCk7XG4gIGlmIChob3VycyA8IDI0KSByZXR1cm4gYHZvciAke2hvdXJzfWhgO1xuICBjb25zdCBkYXlzID0gTWF0aC5mbG9vcihob3VycyAvIDI0KTtcbiAgaWYgKGRheXMgPCAzMCkgcmV0dXJuIGB2b3IgJHtkYXlzfWRgO1xuICByZXR1cm4gbmV3IERhdGUoZCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZGUtREVcIik7XG59XG5cbmZ1bmN0aW9uIHRydW5jKHM6IHN0cmluZyB8IG51bGwsIG46IG51bWJlcik6IHN0cmluZyB7XG4gIGlmICghcykgcmV0dXJuIFwiXFx1MjAxNFwiO1xuICByZXR1cm4gcy5sZW5ndGggPiBuID8gcy5zbGljZSgwLCBuKSArIFwiXFx1MjAyNlwiIDogcztcbn1cblxuZnVuY3Rpb24gbnVtKG46IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiAobiB8fCAwKS50b0xvY2FsZVN0cmluZyhcImRlLURFXCIpO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENvbmZpZ1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBLUElfSVRFTVM6IHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IGljb246IHN0cmluZyB9W10gPSBbXG4gIHsga2V5OiBcImFwcHNcIiwgbGFiZWw6IFwiQXBwc1wiLCBpY29uOiBcIlNtYXJ0cGhvbmVcIiB9LFxuICB7IGtleTogXCJ1c2Vyc1wiLCBsYWJlbDogXCJVc2Vyc1wiLCBpY29uOiBcIlVzZXJzXCIgfSxcbiAgeyBrZXk6IFwidGVhbXNcIiwgbGFiZWw6IFwiVGVhbXNcIiwgaWNvbjogXCJCcmllZmNhc2VcIiB9LFxuICB7IGtleTogXCJrZXl3b3Jkc1wiLCBsYWJlbDogXCJLZXl3b3Jkc1wiLCBpY29uOiBcIktleVwiIH0sXG4gIHsga2V5OiBcInN1Z2dlc3Rpb25zXCIsIGxhYmVsOiBcIlZvcnNjaGxhZWdlXCIsIGljb246IFwiWmFwXCIgfSxcbiAgeyBrZXk6IFwiZXhwZXJpbWVudHNcIiwgbGFiZWw6IFwiRXhwZXJpbWVudHNcIiwgaWNvbjogXCJHaXRCcmFuY2hcIiB9LFxuICB7IGtleTogXCJzY3JlZW5zaG90Sm9ic1wiLCBsYWJlbDogXCJTY3JlZW5zaG90c1wiLCBpY29uOiBcIkNhbWVyYVwiIH0sXG4gIHsga2V5OiBcImJ1aWxkSm9ic1wiLCBsYWJlbDogXCJCdWlsZHNcIiwgaWNvbjogXCJQYWNrYWdlXCIgfSxcbiAgeyBrZXk6IFwiYW5hbHl0aWNzUmVjb3Jkc1wiLCBsYWJlbDogXCJBbmFseXRpY3NcIiwgaWNvbjogXCJUcmVuZGluZ1VwXCIgfSxcbiAgeyBrZXk6IFwicmV2aWV3c1wiLCBsYWJlbDogXCJSZXZpZXdzXCIsIGljb246IFwiU3RhclwiIH0sXG5dO1xuXG5jb25zdCBRVUlDS19MSU5LUzogeyBsYWJlbDogc3RyaW5nOyBpY29uOiBzdHJpbmc7IHJlc291cmNlOiBzdHJpbmcgfVtdID0gW1xuICB7IGxhYmVsOiBcIkFwcHNcIiwgaWNvbjogXCJTbWFydHBob25lXCIsIHJlc291cmNlOiBcIkFwcFwiIH0sXG4gIHsgbGFiZWw6IFwiS2V5d29yZHNcIiwgaWNvbjogXCJLZXlcIiwgcmVzb3VyY2U6IFwiS2V5d29yZFwiIH0sXG4gIHsgbGFiZWw6IFwiQVNPIEV4cGVyaW1lbnRzXCIsIGljb246IFwiR2l0QnJhbmNoXCIsIHJlc291cmNlOiBcIkFzb0V4cGVyaW1lbnRcIiB9LFxuICB7IGxhYmVsOiBcIlZvcnNjaGxhZWdlXCIsIGljb246IFwiWmFwXCIsIHJlc291cmNlOiBcIkFTT1N1Z2dlc3Rpb25cIiB9LFxuICB7IGxhYmVsOiBcIkJlbnV0emVyXCIsIGljb246IFwiVXNlcnNcIiwgcmVzb3VyY2U6IFwiVXNlclwiIH0sXG4gIHsgbGFiZWw6IFwiU2NyZWVuc2hvdCBKb2JzXCIsIGljb246IFwiQ2FtZXJhXCIsIHJlc291cmNlOiBcIlNjcmVlbnNob3RKb2JcIiB9LFxuICB7IGxhYmVsOiBcIkJ1aWxkIEpvYnNcIiwgaWNvbjogXCJQYWNrYWdlXCIsIHJlc291cmNlOiBcIkJ1aWxkSm9iXCIgfSxcbiAgeyBsYWJlbDogXCJBbmFseXRpY3NcIiwgaWNvbjogXCJUcmVuZGluZ1VwXCIsIHJlc291cmNlOiBcIkFwcFN0b3JlQW5hbHl0aWNzXCIgfSxcbiAgeyBsYWJlbDogXCJSZXZpZXdzXCIsIGljb246IFwiU3RhclwiLCByZXNvdXJjZTogXCJBcHBSZXZpZXdcIiB9LFxuICB7IGxhYmVsOiBcIk1ldGFkYXRlblwiLCBpY29uOiBcIkZpbGVUZXh0XCIsIHJlc291cmNlOiBcIkFwcE1ldGFkYXRhQ2hhbmdlXCIgfSxcbl07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gRGFzaGJvYXJkIENvbXBvbmVudFxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBEYXNoYm9hcmQ6IFJlYWN0LkZDID0gKCkgPT4ge1xuICBjb25zdCBbZGF0YSwgc2V0RGF0YV0gPSB1c2VTdGF0ZTxhbnk+KG51bGwpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFwaVxuICAgICAgLmdldERhc2hib2FyZCgpXG4gICAgICAudGhlbigocmVzOiBhbnkpID0+IHNldERhdGEocmVzLmRhdGEpKVxuICAgICAgLmZpbmFsbHkoKCkgPT4gc2V0TG9hZGluZyhmYWxzZSkpO1xuICB9LCBbXSk7XG5cbiAgaWYgKGxvYWRpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBqdXN0aWZ5Q29udGVudD1cImNlbnRlclwiIHB5PVwieHhsXCI+XG4gICAgICAgIDxMb2FkZXIgLz5cbiAgICAgIDwvQm94PlxuICAgICk7XG4gIH1cblxuICBpZiAoIWRhdGEpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBwPVwieGxcIj5cbiAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPkRhdGVuIGtvbm50ZW4gbmljaHQgZ2VsYWRlbiB3ZXJkZW4uPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPEJveCBwPVwieGxcIiBtYXhXaWR0aD17MTIwMH0gbXg9XCJhdXRvXCI+XG4gICAgICB7LyogR3JhZGllbnQgYmFyICovfVxuICAgICAgPEJveCBoZWlnaHQ9ezR9IGJnPVwicHJpbWFyeTEwMFwiIGJvcmRlclJhZGl1cz1cImRlZmF1bHRcIiBtYj1cInhsXCIgLz5cblxuICAgICAgey8qIEhlYWRlciAqL31cbiAgICAgIDxCb3ggbWI9XCJ4bFwiPlxuICAgICAgICA8SDIgY29sb3I9XCJwcmltYXJ5MTAwXCI+TWFydGVzbyBBZG1pbjwvSDI+XG4gICAgICAgIDxUZXh0IHZhcmlhbnQ9XCJzbVwiIGNvbG9yPVwiZ3JleTYwXCI+XG4gICAgICAgICAgQVNPIEVuZ2luZSDigJQgQ29udHJvbCBDZW50ZXJcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBLUEkgQ2FyZHMgKi99XG4gICAgICA8Qm94IGZsZXggZmxleERpcmVjdGlvbj1cInJvd1wiIGZsZXhXcmFwPVwid3JhcFwiIG1iPVwieGxcIiBzdHlsZT17eyBnYXA6IDEyIH19PlxuICAgICAgICB7S1BJX0lURU1TLm1hcCgoaXRlbSkgPT4gKFxuICAgICAgICAgIDxCb3gga2V5PXtpdGVtLmtleX0gYmc9XCJ3aGl0ZVwiIGJvcmRlcj1cImRlZmF1bHRcIiBib3JkZXJSYWRpdXM9XCJkZWZhdWx0XCIgcD1cImxnXCIgc3R5bGU9e3sgbWluV2lkdGg6IDE1MCwgbWF4V2lkdGg6IDIwMCwgZmxleDogXCIxIDEgMTUwcHhcIiB9fT5cbiAgICAgICAgICAgIDxCb3ggZmxleCBmbGV4RGlyZWN0aW9uPVwicm93XCIgYWxpZ25JdGVtcz1cImNlbnRlclwiIG1iPVwic21cIiBzdHlsZT17eyBnYXA6IDggfX0+XG4gICAgICAgICAgICAgIDxJY29uIGljb249e2l0ZW0uaWNvbn0gc2l6ZT17MTZ9IGNvbG9yPVwiZ3JleTYwXCIgLz5cbiAgICAgICAgICAgICAgPFRleHQgdmFyaWFudD1cInNtXCIgY29sb3I9XCJncmV5NjBcIiBmb250V2VpZ2h0PVwiYm9sZFwiIHRleHRUcmFuc2Zvcm09XCJ1cHBlcmNhc2VcIj5cbiAgICAgICAgICAgICAgICB7aXRlbS5sYWJlbH1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8VGV4dCBmb250U2l6ZT17Mjh9IGZvbnRXZWlnaHQ9XCJib2xkXCIgY29sb3I9XCJwcmltYXJ5MTAwXCI+XG4gICAgICAgICAgICAgIHtudW0oZGF0YVtpdGVtLmtleV0pfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApKX1cbiAgICAgIDwvQm94PlxuXG4gICAgICB7LyogUXVpY2sgbGlua3MgKi99XG4gICAgICA8SDUgbWI9XCJsZ1wiIG10PVwieGxcIj5TY2huZWxsenVncmlmZjwvSDU+XG4gICAgICA8Qm94IGZsZXggZmxleERpcmVjdGlvbj1cInJvd1wiIGZsZXhXcmFwPVwid3JhcFwiIG1iPVwieGxcIiBzdHlsZT17eyBnYXA6IDEwIH19PlxuICAgICAgICB7UVVJQ0tfTElOS1MubWFwKChsaW5rKSA9PiAoXG4gICAgICAgICAgPEJveFxuICAgICAgICAgICAga2V5PXtsaW5rLnJlc291cmNlfVxuICAgICAgICAgICAgYXM9XCJhXCJcbiAgICAgICAgICAgIGhyZWY9e2AvYWRtaW4vcmVzb3VyY2VzLyR7bGluay5yZXNvdXJjZX1gfVxuICAgICAgICAgICAgZmxleFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cInJvd1wiXG4gICAgICAgICAgICBhbGlnbkl0ZW1zPVwiY2VudGVyXCJcbiAgICAgICAgICAgIGJnPVwid2hpdGVcIlxuICAgICAgICAgICAgYm9yZGVyPVwiZGVmYXVsdFwiXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM9XCJkZWZhdWx0XCJcbiAgICAgICAgICAgIHA9XCJkZWZhdWx0XCJcbiAgICAgICAgICAgIHN0eWxlPXt7IGdhcDogMTAsIHRleHREZWNvcmF0aW9uOiBcIm5vbmVcIiwgY29sb3I6IFwiIzExMTgyN1wiLCBmb250U2l6ZTogMTMsIGZvbnRXZWlnaHQ6IDYwMCwgbWluV2lkdGg6IDE2MCB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxJY29uIGljb249e2xpbmsuaWNvbn0gc2l6ZT17MTZ9IGNvbG9yPVwicHJpbWFyeTEwMFwiIC8+XG4gICAgICAgICAgICA8c3Bhbj57bGluay5sYWJlbH08L3NwYW4+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICkpfVxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBSZWNlbnQgSm9icyAqL31cbiAgICAgIHtkYXRhLnJlY2VudEpvYnM/Lmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8Qm94IG1iPVwieGxcIj5cbiAgICAgICAgICA8SDUgbWI9XCJsZ1wiPkxldHp0ZSBKb2JzPC9INT5cbiAgICAgICAgICA8Qm94IGJnPVwid2hpdGVcIiBib3JkZXI9XCJkZWZhdWx0XCIgYm9yZGVyUmFkaXVzPVwiZGVmYXVsdFwiIHN0eWxlPXt7IG92ZXJmbG93OiBcImhpZGRlblwiIH19PlxuICAgICAgICAgICAgPFRhYmxlPlxuICAgICAgICAgICAgICA8VGFibGVIZWFkPlxuICAgICAgICAgICAgICAgIDxUYWJsZVJvdz5cbiAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+VHlwPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkFwcDwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5TdGF0dXM8L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+QnJhbmNoIC8gQ29tbWl0PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkVyc3RlbGx0PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgPC9UYWJsZVJvdz5cbiAgICAgICAgICAgICAgPC9UYWJsZUhlYWQ+XG4gICAgICAgICAgICAgIDxUYWJsZUJvZHk+XG4gICAgICAgICAgICAgICAge2RhdGEucmVjZW50Sm9icy5tYXAoKGo6IGFueSwgaTogbnVtYmVyKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8VGFibGVSb3cga2V5PXtpfT5cbiAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbCBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAgfX0+e2ouX3R5cGV9PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+e2ouYXBwTmFtZSB8fCBcIlxcdTIwMTRcIn08L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgICA8QmFkZ2UgdmFyaWFudD17c3RhdHVzQ29sb3Ioai5zdGF0dXMpfT57ai5zdGF0dXN9PC9CYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGwgc3R5bGU9e3sgZm9udEZhbWlseTogXCJtb25vc3BhY2VcIiwgZm9udFNpemU6IDEyLCBjb2xvcjogXCIjOGI5M2E1XCIgfX0+XG4gICAgICAgICAgICAgICAgICAgICAge2ouYnJhbmNoIHx8IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAge2ouY29tbWl0U2hhID8gYCAke2ouY29tbWl0U2hhLnNsaWNlKDAsIDcpfWAgOiBcIlwifVxuICAgICAgICAgICAgICAgICAgICA8L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbCBzdHlsZT17eyBjb2xvcjogXCIjOGI5M2E1XCIsIGZvbnRTaXplOiAxMiB9fT57dGltZUFnbyhqLmNyZWF0ZWRBdCl9PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8L1RhYmxlUm93PlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L1RhYmxlQm9keT5cbiAgICAgICAgICAgIDwvVGFibGU+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFJlY2VudCBFeHBlcmltZW50cyAqL31cbiAgICAgIHtkYXRhLnJlY2VudEV4cGVyaW1lbnRzPy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPEJveCBtYj1cInhsXCI+XG4gICAgICAgICAgPEg1IG1iPVwibGdcIj5MZXR6dGUgQVNPIEV4cGVyaW1lbnRzPC9INT5cbiAgICAgICAgICA8Qm94IGJnPVwid2hpdGVcIiBib3JkZXI9XCJkZWZhdWx0XCIgYm9yZGVyUmFkaXVzPVwiZGVmYXVsdFwiIHN0eWxlPXt7IG92ZXJmbG93OiBcImhpZGRlblwiIH19PlxuICAgICAgICAgICAgPFRhYmxlPlxuICAgICAgICAgICAgICA8VGFibGVIZWFkPlxuICAgICAgICAgICAgICAgIDxUYWJsZVJvdz5cbiAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+QXBwPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPlR5cDwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5Wb24gLyBOYWNoPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkNvbmZpZGVuY2U8L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+U3RhdHVzPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkVyc3RlbGx0PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgPC9UYWJsZVJvdz5cbiAgICAgICAgICAgICAgPC9UYWJsZUhlYWQ+XG4gICAgICAgICAgICAgIDxUYWJsZUJvZHk+XG4gICAgICAgICAgICAgICAge2RhdGEucmVjZW50RXhwZXJpbWVudHMubWFwKChlOiBhbnksIGk6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgY29uZiA9IE1hdGgucm91bmQoKGUuY29uZmlkZW5jZSB8fCAwKSAqIDEwMCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjYyA9IGNvbmYgPj0gODAgPyBcInN1Y2Nlc3NcIiA6IGNvbmYgPj0gNTAgPyBcIndhcm5pbmdcIiA6IFwiZGFuZ2VyXCI7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICA8VGFibGVSb3cga2V5PXtpfT5cbiAgICAgICAgICAgICAgICAgICAgICA8VGFibGVDZWxsIHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDUwMCB9fT57ZS5hcHA/Lm5hbWUgfHwgXCJcXHUyMDE0XCJ9PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD57KGUudHlwZSB8fCBcIlwiKS5yZXBsYWNlKC9fL2csIFwiIFwiKX08L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgdmFyaWFudD1cInNtXCIgY29sb3I9XCJncmV5NjBcIiBhcz1cInNwYW5cIj57dHJ1bmMoZS5mcm9tVmFsdWUsIDE4KX08L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCB2YXJpYW50PVwic21cIiBjb2xvcj1cImdyZXk0MFwiIGFzPVwic3BhblwiIG14PVwic21cIj4mcmFycjs8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCB2YXJpYW50PVwic21cIiBhcz1cInNwYW5cIiBmb250V2VpZ2h0PVwiYm9sZFwiPnt0cnVuYyhlLnRvVmFsdWUsIDE4KX08L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxCYWRnZSB2YXJpYW50PXtjY30+e2NvbmZ9JTwvQmFkZ2U+XG4gICAgICAgICAgICAgICAgICAgICAgPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxCYWRnZSB2YXJpYW50PXtzdGF0dXNDb2xvcihlLnN0YXR1cyl9PntlLnN0YXR1c308L0JhZGdlPlxuICAgICAgICAgICAgICAgICAgICAgIDwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGwgc3R5bGU9e3sgY29sb3I6IFwiIzhiOTNhNVwiLCBmb250U2l6ZTogMTIgfX0+e3RpbWVBZ28oZS5jcmVhdGVkQXQpfTwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgICA8L1RhYmxlUm93PlxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgICAgPC9UYWJsZUJvZHk+XG4gICAgICAgICAgICA8L1RhYmxlPlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBSZWNlbnQgQXBwcyAqL31cbiAgICAgIHtkYXRhLnJlY2VudEFwcHM/Lmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8Qm94IG1iPVwieGxcIj5cbiAgICAgICAgICA8SDUgbWI9XCJsZ1wiPkt1ZXJ6bGljaCBha3R1YWxpc2llcnRlIEFwcHM8L0g1PlxuICAgICAgICAgIDxCb3ggYmc9XCJ3aGl0ZVwiIGJvcmRlcj1cImRlZmF1bHRcIiBib3JkZXJSYWRpdXM9XCJkZWZhdWx0XCIgc3R5bGU9e3sgb3ZlcmZsb3c6IFwiaGlkZGVuXCIgfX0+XG4gICAgICAgICAgICA8VGFibGU+XG4gICAgICAgICAgICAgIDxUYWJsZUhlYWQ+XG4gICAgICAgICAgICAgICAgPFRhYmxlUm93PlxuICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5OYW1lPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkJ1bmRsZSBJRDwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbD5MYW5kPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICA8VGFibGVDZWxsPkVpZ2VuZSBBcHA8L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+QWt0dWFsaXNpZXJ0PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgPC9UYWJsZVJvdz5cbiAgICAgICAgICAgICAgPC9UYWJsZUhlYWQ+XG4gICAgICAgICAgICAgIDxUYWJsZUJvZHk+XG4gICAgICAgICAgICAgICAge2RhdGEucmVjZW50QXBwcy5tYXAoKGE6IGFueSwgaTogbnVtYmVyKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8VGFibGVSb3cga2V5PXtpfT5cbiAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbCBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAgfX0+e2EubmFtZX08L1RhYmxlQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgPFRhYmxlQ2VsbCBzdHlsZT17eyBmb250RmFtaWx5OiBcIm1vbm9zcGFjZVwiLCBmb250U2l6ZTogMTIsIGNvbG9yOiBcIiM4YjkzYTVcIiB9fT5cbiAgICAgICAgICAgICAgICAgICAgICB7YS5idW5kbGVJZH1cbiAgICAgICAgICAgICAgICAgICAgPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+eyhhLmNvdW50cnkgfHwgXCJcXHUyMDE0XCIpLnRvVXBwZXJDYXNlKCl9PC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9e2EuaXNPd25BcHAgPyBcInN1Y2Nlc3NcIiA6IFwiZGVmYXVsdFwifT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHthLmlzT3duQXBwID8gXCJKYVwiIDogXCJOZWluXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgPC9CYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgPC9UYWJsZUNlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxUYWJsZUNlbGwgc3R5bGU9e3sgY29sb3I6IFwiIzhiOTNhNVwiLCBmb250U2l6ZTogMTIgfX0+e3RpbWVBZ28oYS51cGRhdGVkQXQpfTwvVGFibGVDZWxsPlxuICAgICAgICAgICAgICAgICAgPC9UYWJsZVJvdz5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9UYWJsZUJvZHk+XG4gICAgICAgICAgICA8L1RhYmxlPlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIDxCb3ggcHk9XCJ4bFwiIHN0eWxlPXt7IHRleHRBbGlnbjogXCJjZW50ZXJcIiB9fT5cbiAgICAgICAgPFRleHQgdmFyaWFudD1cInNtXCIgY29sb3I9XCJncmV5NjBcIj5cbiAgICAgICAgICBNYXJ0ZXNvIEFTTyBFbmdpbmUg4oCUIEFkbWluIERhc2hib2FyZFxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IERhc2hib2FyZDtcbiIsIkFkbWluSlMuVXNlckNvbXBvbmVudHMgPSB7fVxuaW1wb3J0IERhc2hib2FyZCBmcm9tICcuLi9hZG1pbi9zcmMvY29tcG9uZW50cy9kYXNoYm9hcmQnXG5BZG1pbkpTLlVzZXJDb21wb25lbnRzLkRhc2hib2FyZCA9IERhc2hib2FyZCJdLCJuYW1lcyI6WyJhcGkiLCJBcGlDbGllbnQiLCJzdGF0dXNDb2xvciIsInMiLCJtIiwiUEVORElORyIsIlJVTk5JTkciLCJDT01QTEVURUQiLCJGQUlMRUQiLCJBUFBST1ZFRCIsIkFQUExJRUQiLCJSRUpFQ1RFRCIsIkRFUExPWUVEIiwiRVZBTFVBVEVEIiwidGltZUFnbyIsImQiLCJkaWZmIiwiRGF0ZSIsIm5vdyIsImdldFRpbWUiLCJtaW5zIiwiTWF0aCIsImZsb29yIiwiaG91cnMiLCJkYXlzIiwidG9Mb2NhbGVEYXRlU3RyaW5nIiwidHJ1bmMiLCJuIiwibGVuZ3RoIiwic2xpY2UiLCJudW0iLCJ0b0xvY2FsZVN0cmluZyIsIktQSV9JVEVNUyIsImtleSIsImxhYmVsIiwiaWNvbiIsIlFVSUNLX0xJTktTIiwicmVzb3VyY2UiLCJEYXNoYm9hcmQiLCJkYXRhIiwic2V0RGF0YSIsInVzZVN0YXRlIiwibG9hZGluZyIsInNldExvYWRpbmciLCJ1c2VFZmZlY3QiLCJnZXREYXNoYm9hcmQiLCJ0aGVuIiwicmVzIiwiZmluYWxseSIsIlJlYWN0IiwiY3JlYXRlRWxlbWVudCIsIkJveCIsImZsZXgiLCJmbGV4RGlyZWN0aW9uIiwianVzdGlmeUNvbnRlbnQiLCJweSIsIkxvYWRlciIsInAiLCJUZXh0IiwiY29sb3IiLCJtYXhXaWR0aCIsIm14IiwiaGVpZ2h0IiwiYmciLCJib3JkZXJSYWRpdXMiLCJtYiIsIkgyIiwidmFyaWFudCIsImZsZXhXcmFwIiwic3R5bGUiLCJnYXAiLCJtYXAiLCJpdGVtIiwiYm9yZGVyIiwibWluV2lkdGgiLCJhbGlnbkl0ZW1zIiwiSWNvbiIsInNpemUiLCJmb250V2VpZ2h0IiwidGV4dFRyYW5zZm9ybSIsImZvbnRTaXplIiwiSDUiLCJtdCIsImxpbmsiLCJhcyIsImhyZWYiLCJ0ZXh0RGVjb3JhdGlvbiIsInJlY2VudEpvYnMiLCJvdmVyZmxvdyIsIlRhYmxlIiwiVGFibGVIZWFkIiwiVGFibGVSb3ciLCJUYWJsZUNlbGwiLCJUYWJsZUJvZHkiLCJqIiwiaSIsIl90eXBlIiwiYXBwTmFtZSIsIkJhZGdlIiwic3RhdHVzIiwiZm9udEZhbWlseSIsImJyYW5jaCIsImNvbW1pdFNoYSIsImNyZWF0ZWRBdCIsInJlY2VudEV4cGVyaW1lbnRzIiwiZSIsImNvbmYiLCJyb3VuZCIsImNvbmZpZGVuY2UiLCJjYyIsImFwcCIsIm5hbWUiLCJ0eXBlIiwicmVwbGFjZSIsImZyb21WYWx1ZSIsInRvVmFsdWUiLCJyZWNlbnRBcHBzIiwiYSIsImJ1bmRsZUlkIiwiY291bnRyeSIsInRvVXBwZXJDYXNlIiwiaXNPd25BcHAiLCJ1cGRhdGVkQXQiLCJ0ZXh0QWxpZ24iLCJBZG1pbkpTIiwiVXNlckNvbXBvbmVudHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7RUFpQkEsTUFBTUEsR0FBRyxHQUFHLElBQUlDLGlCQUFTLEVBQUU7O0VBRTNCO0VBQ0E7RUFDQTtFQUNBLFNBQVNDLFdBQVdBLENBQUNDLENBQVMsRUFBVTtFQUN0QyxFQUFBLE1BQU1DLENBQXlCLEdBQUc7RUFDaENDLElBQUFBLE9BQU8sRUFBRSxTQUFTO0VBQ2xCQyxJQUFBQSxPQUFPLEVBQUUsTUFBTTtFQUNmQyxJQUFBQSxTQUFTLEVBQUUsU0FBUztFQUNwQkMsSUFBQUEsTUFBTSxFQUFFLFFBQVE7RUFDaEJDLElBQUFBLFFBQVEsRUFBRSxNQUFNO0VBQ2hCQyxJQUFBQSxPQUFPLEVBQUUsU0FBUztFQUNsQkMsSUFBQUEsUUFBUSxFQUFFLFNBQVM7RUFDbkJDLElBQUFBLFFBQVEsRUFBRSxNQUFNO0VBQ2hC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
