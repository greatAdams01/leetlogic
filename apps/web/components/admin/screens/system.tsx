import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgLeetlogicIcon = `${assetPathPrefix}/19873.svg`;
const imgUser = `${assetPathPrefix}/4c9a1.svg`;
const imgShieldTick = `${assetPathPrefix}/9670c.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/dcdcd.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/93749.svg`;
const imgArchive = `${assetPathPrefix}/d19a5.svg`;
const imgTruck = `${assetPathPrefix}/b8b77.svg`;
const imgUsers = `${assetPathPrefix}/8f3a1.svg`;
const imgServer = `${assetPathPrefix}/7abe1.svg`;
const imgKey02 = `${assetPathPrefix}/1bcbf.svg`;
const imgBookOpen = `${assetPathPrefix}/9dc1e.svg`;
const imgClipboard = `${assetPathPrefix}/7f58b.svg`;
const imgSettings = `${assetPathPrefix}/29e3e.svg`;
const imgLockKeyholeSquare = `${assetPathPrefix}/85d95.svg`;
const imgBell = `${assetPathPrefix}/6fe5a.svg`;
const imgHelpCircle = `${assetPathPrefix}/010d1.svg`;
const imgUserCircle = `${assetPathPrefix}/52ed8.svg`;
const imgAlertTriangle = `${assetPathPrefix}/55877.svg`;
const imgToggleState = `${assetPathPrefix}/43161.svg`;
const imgToggleState1 = `${assetPathPrefix}/5d274.svg`;
const imgGatewayTrend = `${assetPathPrefix}/c4b9f.svg`;
const imgAnnouncement03 = `${assetPathPrefix}/c7a73.svg`;
const imgCheck = `${assetPathPrefix}/6ff7b.svg`;
const imgVector = `${assetPathPrefix}/f9ed5.svg`;
const imgShieldTick1 = `${assetPathPrefix}/0623e.svg`;
export default function Component2903SystemStatusAndMaintenance() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:46264"
      data-name="29.03 · System status and maintenance"
    >
      <div
        className="admin-element-035f7b053"
        data-node-id="2521:46265"
        data-name="Operations sidebar"
      >
        <div className="admin-element-47aacf6d1" data-node-id="2521:46266" data-name="Row">
          <div
            className="admin-element-a6f8c7bf2"
            data-node-id="2521:46267"
            data-name="Leetlogic icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLeetlogicIcon} />
          </div>
          <div
            className="admin-element-c770a29d3"
            data-node-id="2521:46270"
            data-name="Brand identity"
          >
            <p
              className="admin-element-6d2c3b228"
              data-node-id="2521:46271"
              style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            >
              Leetlogic
            </p>
            <p
              className="admin-element-5a7d6aeb8"
              data-node-id="2521:46272"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Operations
            </p>
          </div>
        </div>
        <div
          className="admin-element-006f51d71"
          data-node-id="2521:46273"
          data-name="Signed-in administrator"
        >
          <div className="admin-element-eaa60f1c4" data-node-id="2521:46274" data-name="user">
            <img alt="" className="admin-element-8faf267d3" src={imgUser} />
          </div>
          <div
            className="admin-element-c770a29d3"
            data-node-id="2521:46275"
            data-name="Admin identity"
          >
            <p
              className="admin-element-74c7cf5ba"
              data-node-id="2521:46276"
              style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            >
              Amaka
            </p>
            <p
              className="admin-element-5a7d6aeb8"
              data-node-id="2521:46277"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Operations Admin
            </p>
          </div>
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:46278"
            data-name="shield-tick"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgShieldTick} />
          </div>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46279" data-name="Sidebar item">
          <div
            className="admin-element-b2a182ecf"
            data-node-id="2521:46280"
            data-name="layout-alt-01"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46281"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46282" data-name="Sidebar item">
          <div
            className="admin-element-b2a182ecf"
            data-node-id="2521:46283"
            data-name="check-verified-03"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46284"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/verification"
          >
            Verification Queue
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46285" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46286" data-name="archive">
            <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46287"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/listings"
          >
            Listings
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46288" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46289" data-name="truck">
            <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46290"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/orders"
          >
            Orders
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46291" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46292" data-name="users">
            <img alt="" className="admin-element-8faf267d3" src={imgUsers} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46293"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/users"
          >
            Users
          </Link>
        </div>
        <div className="admin-element-826a38a85" data-node-id="2521:46294" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46295" data-name="server">
            <img alt="" className="admin-element-8faf267d3" src={imgServer} />
          </div>
          <Link
            className="admin-element-714c5d572"
            data-node-id="2521:46296"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/system"
          >
            System Status
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46297" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46298" data-name="key-02">
            <img alt="" className="admin-element-8faf267d3" src={imgKey02} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46299"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/roles"
          >
            Roles
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46300" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46301" data-name="book-open">
            <img alt="" className="admin-element-8faf267d3" src={imgBookOpen} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46302"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/faq"
          >{`FAQ & Content`}</Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46303" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46304" data-name="clipboard">
            <img alt="" className="admin-element-8faf267d3" src={imgClipboard} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46305"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/audit"
          >
            Audit Logs
          </Link>
        </div>
        <div className="admin-element-5301e7ea7" data-node-id="2521:46306" data-name="Sidebar item">
          <div className="admin-element-b2a182ecf" data-node-id="2521:46307" data-name="settings">
            <img alt="" className="admin-element-8faf267d3" src={imgSettings} />
          </div>
          <Link
            className="admin-element-b19c58f60"
            data-node-id="2521:46308"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/settings"
          >
            Settings
          </Link>
        </div>
        <div
          className="admin-element-462465721"
          data-node-id="2521:46309"
          data-name="Operations policy"
        >
          <p
            className="admin-element-e63e0b09b"
            data-node-id="2521:46310"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            ● Ops Portal v2.4
          </p>
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:46311"
            data-name="lock-keyhole-square"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLockKeyholeSquare} />
          </div>
        </div>
      </div>
      <div
        className="admin-element-11f15fd13"
        data-node-id="2521:46312"
        data-name="Operations workspace"
      >
        <div
          className="admin-element-f8f450c42"
          data-node-id="2521:46313"
          data-name="Workspace topbar"
        >
          <div
            className="admin-element-7c219a7f7"
            data-node-id="2521:46314"
            data-name="Editable field"
          >
            <AdminField
              className="admin-element-011d44306"
              data-node-id="I2521:46314;1091:63800"
              data-name="_Input field base"
              initialValue="Search orders, farmers, commodities, or audit records..."
              label="Staff input"
            />
          </div>
          <div
            className="admin-element-f4e90be63"
            data-node-id="2521:46315"
            data-name="Status badge"
          >
            <p
              className="admin-element-37e09b9cf"
              data-node-id="2521:46316"
              style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            >
              ● System operational 99.98%
            </p>
          </div>
          <div className="admin-element-eaa60f1c4" data-node-id="2521:46317" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:46318"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:46319"
            data-name="user-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgUserCircle} />
          </div>
        </div>
        <div
          className="admin-element-9278b038e"
          data-node-id="2521:46320"
          data-name="Workspace content"
        >
          <div
            className="admin-element-1bee4fe88"
            data-node-id="2521:46321"
            data-name="Active incident policy warning"
          >
            <div
              className="admin-element-842ae29a3"
              data-node-id="2521:46322"
              data-name="alert-triangle"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgAlertTriangle} />
            </div>
            <div
              className="admin-element-2cccba0c3"
              data-node-id="2521:46323"
              data-name="Incident summary"
            >
              <div className="admin-element-47aacf6d1" data-node-id="2521:46324" data-name="Row">
                <p
                  className="admin-element-aebbddc86"
                  data-node-id="2521:46325"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  System incident active
                </p>
                <div
                  className="admin-element-a80d6a3e7"
                  data-node-id="2521:46326"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-2757614c1"
                    data-node-id="2521:46327"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    Payments down
                  </p>
                </div>
              </div>
              <p
                className="admin-element-f13c8c588"
                data-node-id="2521:46328"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Payments service is currently set to DOWN. Public operational notice is live and
                broadcasting to mobile apps.
              </p>
            </div>
            <div
              className="admin-element-a80d6a3e7"
              data-node-id="2521:46329"
              data-name="Status badge"
            >
              <p
                className="admin-element-2757614c1"
                data-node-id="2521:46330"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                View broadcast
              </p>
            </div>
            <div
              className="admin-element-f4e90be63"
              data-node-id="2521:46331"
              data-name="Status badge"
            >
              <p
                className="admin-element-37e09b9cf"
                data-node-id="2521:46332"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Sync metrics
              </p>
            </div>
          </div>
          <div className="admin-element-47aacf6d1" data-node-id="2521:46333" data-name="Row">
            <div
              className="admin-element-3bf226251"
              data-node-id="2521:46334"
              data-name="Workspace heading"
            >
              <p
                className="admin-element-f839f632c"
                data-node-id="2521:46335"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Infrastructure Operations Engine
              </p>
              <p
                className="admin-element-527154671"
                data-node-id="2521:46336"
              >{`System status & maintenance control`}</p>
              <p
                className="admin-element-e2376766c"
                data-node-id="2521:46337"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Live toggles for critical marketplace infrastructure and public operational notices
                across Nigeria terminals.
              </p>
            </div>
            <div
              className="admin-element-d87aac962"
              data-node-id="2521:46338"
              data-name="SLA metric"
            >
              <div
                className="admin-element-198955748"
                data-node-id="2521:46339"
                data-name="Gateway SLA"
              >
                <p
                  className="admin-element-66c5136e9"
                  data-node-id="2521:46340"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Global gateway SLA
                </p>
                <p
                  className="admin-element-9841b0666"
                  data-node-id="2521:46341"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  99.98%
                </p>
              </div>
            </div>
            <div
              className="admin-element-6a36566d8"
              data-node-id="2521:46342"
              data-name="Sessions metric"
            >
              <div
                className="admin-element-198955748"
                data-node-id="2521:46343"
                data-name="Mobile sessions"
              >
                <p
                  className="admin-element-66c5136e9"
                  data-node-id="2521:46344"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Active mobile sessions
                </p>
                <p
                  className="admin-element-6ddb4763b"
                  data-node-id="2521:46345"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  42,819
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-d744263b4"
            data-node-id="2521:46346"
            data-name="Service and broadcast columns"
          >
            <div
              className="admin-element-0b6099976"
              data-node-id="2521:46347"
              data-name="Core infrastructure"
            >
              <div className="admin-element-1ab2f0d1d" data-node-id="2521:46348" data-name="Row">
                <p
                  className="admin-element-02104f713"
                  data-node-id="2521:46349"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  Core infrastructure services
                </p>
                <p
                  className="admin-element-2c7134219"
                  data-node-id="2521:46350"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  State changes sync immediately
                </p>
              </div>
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46351"
                data-name="Service toggle"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46352" data-name="Row">
                  <p
                    className="admin-element-aebbddc86"
                    data-node-id="2521:46353"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >{`Produce Listings & Catalog`}</p>
                  <div
                    className="admin-element-f4e90be63"
                    data-node-id="2521:46354"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-37e09b9cf"
                      data-node-id="2521:46355"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Operational (UP)
                    </p>
                  </div>
                  <AdminControl
                    className="admin-element-54cc5dbae"
                    data-node-id="2521:46356"
                    data-name="Toggle state"
                    initialChecked={true}
                    onImageSrc={imgToggleState}
                    offImageSrc={imgToggleState1}
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgToggleState} />
                  </AdminControl>
                </div>
                <p
                  className="admin-element-98b958677"
                  data-node-id="2521:46358"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  99.98% uptime · Real-time sync active across Kano, Lagos, and Ebonyi farm depots.
                </p>
                <p
                  className="admin-element-cd53abb34"
                  data-node-id="2521:46359"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`42ms Latency   ▤ 18,490 active SKUs`}</p>
              </div>
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46360"
                data-name="Service toggle"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46361" data-name="Row">
                  <p
                    className="admin-element-aebbddc86"
                    data-node-id="2521:46362"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >{`Payments & Escrow Processing`}</p>
                  <div
                    className="admin-element-a80d6a3e7"
                    data-node-id="2521:46363"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-2757614c1"
                      data-node-id="2521:46364"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Service down (DEGRADED)
                    </p>
                  </div>
                  <AdminControl
                    className="admin-element-54cc5dbae"
                    data-node-id="2521:46365"
                    data-name="Toggle state"
                    initialChecked={false}
                    onImageSrc={imgToggleState}
                    offImageSrc={imgToggleState1}
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgToggleState1} />
                  </AdminControl>
                </div>
                <p
                  className="admin-element-98b958677"
                  data-node-id="2521:46367"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Interswitch & NIBSS settlement gateway experiencing upstream timeouts. Escrow deposits paused.`}</p>
                <p
                  className="admin-element-5cbb92381"
                  data-node-id="2521:46368"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`14 timeouts in last 5m   ▧ Paused 24m ago`}</p>
              </div>
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46369"
                data-name="Service toggle"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46370" data-name="Row">
                  <p
                    className="admin-element-aebbddc86"
                    data-node-id="2521:46371"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >{`Logistics & Delivery Dispatch`}</p>
                  <div
                    className="admin-element-f4e90be63"
                    data-node-id="2521:46372"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-37e09b9cf"
                      data-node-id="2521:46373"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Operational (UP)
                    </p>
                  </div>
                  <AdminControl
                    className="admin-element-54cc5dbae"
                    data-node-id="2521:46374"
                    data-name="Toggle state"
                    initialChecked={true}
                    onImageSrc={imgToggleState}
                    offImageSrc={imgToggleState1}
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgToggleState} />
                  </AdminControl>
                </div>
                <p
                  className="admin-element-98b958677"
                  data-node-id="2521:46376"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Driver dispatching and SMS coordination running normally across interstate freight
                  corridors.
                </p>
                <p
                  className="admin-element-cd53abb34"
                  data-node-id="2521:46377"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`312 active dispatches   ◷ 98.4% On-time routing`}</p>
              </div>
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46378"
                data-name="Service toggle"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46379" data-name="Row">
                  <p
                    className="admin-element-aebbddc86"
                    data-node-id="2521:46380"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >{`SMS & USSD Gateway (MTN / Airtel / Glo)`}</p>
                  <div
                    className="admin-element-f4e90be63"
                    data-node-id="2521:46381"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-37e09b9cf"
                      data-node-id="2521:46382"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Operational (UP)
                    </p>
                  </div>
                  <AdminControl
                    className="admin-element-54cc5dbae"
                    data-node-id="2521:46383"
                    data-name="Toggle state"
                    initialChecked={true}
                    onImageSrc={imgToggleState}
                    offImageSrc={imgToggleState1}
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgToggleState} />
                  </AdminControl>
                </div>
                <p
                  className="admin-element-98b958677"
                  data-node-id="2521:46385"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  High-throughput rural shortcode routing (*384*224#) active with 99.4% telecom
                  handshake rate.
                </p>
                <p
                  className="admin-element-cd53abb34"
                  data-node-id="2521:46386"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`SMPP Queues Green   ⚑ 1.6s delivery avg`}</p>
              </div>
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46387"
                data-name="Gateway throughput"
              >
                <div className="admin-element-1ab2f0d1d" data-node-id="2521:46388" data-name="Row">
                  <p
                    className="admin-element-02104f713"
                    data-node-id="2521:46389"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    24-hour gateway throughput
                  </p>
                  <p
                    className="admin-element-2c7134219"
                    data-node-id="2521:46390"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Requests / Minute
                  </p>
                </div>
                <div
                  className="admin-element-eb5a20036"
                  data-node-id="2521:46391"
                  data-name="Throughput chart"
                >
                  <div
                    className="admin-element-c622dc650"
                    data-node-id="2521:46392"
                    data-name="Gateway trend"
                  >
                    <div className="admin-element-aae878b72">
                      <img alt="" className="admin-element-acc3667e9" src={imgGatewayTrend} />
                    </div>
                  </div>
                  <div
                    className="admin-element-33426c4fe"
                    data-node-id="2521:46393"
                    data-name="Incident time"
                  />
                </div>
                <p
                  className="admin-element-d75aafff8"
                  data-node-id="2521:46394"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`00:00       06:00       12:00       14:18 (Drop)       Current`}</p>
                <p
                  className="admin-element-56ae58a41"
                  data-node-id="2521:46395"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  NIBSS timeout
                </p>
              </div>
            </div>
            <div
              className="admin-element-f049e64a4"
              data-node-id="2521:46396"
              data-name="Public broadcast"
            >
              <div
                className="admin-element-9c297e32f"
                data-node-id="2521:46397"
                data-name="Public status announcement"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46398" data-name="Row">
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:46399"
                    data-name="announcement-03"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgAnnouncement03} />
                  </div>
                  <p
                    className="admin-element-aebbddc86"
                    data-node-id="2521:46400"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    Public status announcement
                  </p>
                  <div
                    className="admin-element-a80d6a3e7"
                    data-node-id="2521:46401"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-2757614c1"
                      data-node-id="2521:46402"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Live broadcast
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-98b958677"
                  data-node-id="2521:46403"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Broadcasted directly to Nigerian produce farmers, grain wholesalers, and corporate
                  buyers via mobile app banners and push notifications.
                </p>
                <div className="admin-element-47aacf6d1" data-node-id="2521:46404" data-name="Row">
                  <div
                    className="admin-element-cba405628"
                    data-node-id="2521:46405"
                    data-name="Target service"
                  >
                    <p
                      className="admin-element-9f6776a33"
                      data-node-id="2521:46406"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Target service
                    </p>
                    <div
                      className="admin-element-f4e90be63"
                      data-node-id="2521:46407"
                      data-name="Status badge"
                    >
                      <p
                        className="admin-element-37e09b9cf"
                        data-node-id="2521:46408"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >{`Payments & Escrow`}</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-cba405628"
                    data-node-id="2521:46409"
                    data-name="Incident severity"
                  >
                    <p
                      className="admin-element-9f6776a33"
                      data-node-id="2521:46410"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Incident severity
                    </p>
                    <div
                      className="admin-element-a80d6a3e7"
                      data-node-id="2521:46411"
                      data-name="Status badge"
                    >
                      <p
                        className="admin-element-2757614c1"
                        data-node-id="2521:46412"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >
                        ● Major outage
                      </p>
                    </div>
                  </div>
                </div>
                <div className="admin-element-80146c8c9" data-node-id="2521:46413" data-name="Row">
                  <p
                    className="admin-element-624a4eb9d"
                    data-node-id="2521:46414"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Public message content
                  </p>
                  <p
                    className="admin-element-af271dfad"
                    data-node-id="2521:46415"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    248 / 300 chars
                  </p>
                </div>
                <div
                  className="admin-element-bf81dd5d3"
                  data-node-id="2521:46416"
                  data-name="Broadcast message"
                >
                  <p
                    className="admin-element-f13c8c588"
                    data-node-id="2521:46417"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    We are currently experiencing delays with interbank payment settlements and
                    mobile money withdrawals due to maintenance on national banking switch
                    infrastructure (NIBSS). All
                  </p>
                </div>
                <p
                  className="admin-element-afe011ff4"
                  data-node-id="2521:46418"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Notice displays in English and translates automatically to Hausa, Yoruba, and Igbo
                  in apps.
                </p>
                <p
                  className="admin-element-afe011ff4"
                  data-node-id="2521:46419"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Active broadcast channels
                </p>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:46420"
                  data-name="Broadcast channel"
                >
                  <AdminControl
                    className="admin-element-60f8c1910"
                    data-node-id="2521:46421"
                    data-name="Check state"
                  >
                    <div
                      className="admin-element-b2a182ecf"
                      data-node-id="2521:46422"
                      data-name="check"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgCheck} />
                    </div>
                  </AdminControl>
                  <p
                    className="admin-element-cc37ca176"
                    data-node-id="2521:46423"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Farmer App Banner
                  </p>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:46424"
                  data-name="Broadcast channel"
                >
                  <AdminControl
                    className="admin-element-60f8c1910"
                    data-node-id="2521:46425"
                    data-name="Check state"
                  >
                    <div
                      className="admin-element-b2a182ecf"
                      data-node-id="2521:46426"
                      data-name="check"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgCheck} />
                    </div>
                  </AdminControl>
                  <p
                    className="admin-element-cc37ca176"
                    data-node-id="2521:46427"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Buyer App Banner
                  </p>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:46428"
                  data-name="Broadcast channel"
                >
                  <AdminControl
                    className="admin-element-60f8c1910"
                    data-node-id="2521:46429"
                    data-name="Check state"
                  >
                    <div
                      className="admin-element-b2a182ecf"
                      data-node-id="2521:46430"
                      data-name="check"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgCheck} />
                    </div>
                  </AdminControl>
                  <p
                    className="admin-element-cc37ca176"
                    data-node-id="2521:46431"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    SMS alerts for pending payouts (8,410 queued)
                  </p>
                </div>
                <AdminControl
                  className="admin-element-2fd50ba26"
                  data-node-id="2521:46432"
                  data-name="Primary action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:46432;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-902135774"
                    data-node-id="I2521:46432;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-9fc6b6e56"
                      data-node-id="I2521:46432;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Update broadcast notice</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-2dc9dba46"
                    data-node-id="I2521:46432;2521:20137"
                    data-name="SVG:margin"
                  >
                    <div
                      className="admin-element-71a1a822a"
                      data-node-id="I2521:46432;2521:20138"
                      data-name="SVG"
                    >
                      <div
                        className="admin-element-ffa5f14fd"
                        data-node-id="I2521:46432;2521:20139"
                        data-name="SVG"
                      >
                        <div
                          className="admin-element-388053abb"
                          data-node-id="I2521:46432;2521:20140"
                          data-name="Vector"
                        >
                          <div className="admin-element-8085711b6">
                            <img alt="" className="admin-element-acc3667e9" src={imgVector} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AdminControl>
                <p
                  className="admin-element-b30f76641"
                  data-node-id="2521:46433"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >{`Clear notice & restore service`}</p>
              </div>
              <div
                className="admin-element-459ffe545"
                data-node-id="2521:46434"
                data-name="Console ownership"
              >
                <div className="admin-element-47aacf6d1" data-node-id="2521:46435" data-name="Row">
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:46436"
                    data-name="shield-tick"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgShieldTick1} />
                  </div>
                  <div
                    className="admin-element-d2674c045"
                    data-node-id="2521:46437"
                    data-name="Operator profile"
                  >
                    <p
                      className="admin-element-ec71462c4"
                      data-node-id="2521:46438"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Console managed by Amaka Okonkwo
                    </p>
                    <p
                      className="admin-element-5bcfef0a0"
                      data-node-id="2521:46439"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Lead Platform Reliability Officer · Abuja DC
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-9c297e32f"
            data-node-id="2521:46440"
            data-name="System state and incident log"
          >
            <div className="admin-element-47aacf6d1" data-node-id="2521:46441" data-name="Row">
              <div
                className="admin-element-71fe70efe"
                data-node-id="2521:46442"
                data-name="Log heading"
              >
                <p
                  className="admin-element-8fd1abc78"
                  data-node-id="2521:46443"
                >{`System state & incident log`}</p>
                <p
                  className="admin-element-e2376766c"
                  data-node-id="2521:46444"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Immutable audit trail of infrastructure toggles, automated failovers, and root
                  cause updates.
                </p>
              </div>
              <div
                className="admin-element-f4e90be63"
                data-node-id="2521:46445"
                data-name="Status badge"
              >
                <p
                  className="admin-element-37e09b9cf"
                  data-node-id="2521:46446"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  Export audit CSV
                </p>
              </div>
              <div
                className="admin-element-f4e90be63"
                data-node-id="2521:46447"
                data-name="Status badge"
              >
                <p
                  className="admin-element-37e09b9cf"
                  data-node-id="2521:46448"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  Showing last 5 events
                </p>
              </div>
            </div>
            <div
              className="admin-element-f75173c4e"
              data-node-id="2521:46449"
              data-name="Incident table header"
            >
              <p
                className="admin-element-4a9b73a3b"
                data-node-id="2521:46450"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Timestamp
              </p>
              <p
                className="admin-element-4a9b73a3b"
                data-node-id="2521:46451"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Service impacted
              </p>
              <p
                className="admin-element-4a9b73a3b"
                data-node-id="2521:46452"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Transition
              </p>
              <p
                className="admin-element-4a9b73a3b"
                data-node-id="2521:46453"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Operator
              </p>
              <p
                className="admin-element-4a9b73a3b"
                data-node-id="2521:46454"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Duration
              </p>
            </div>
            <div
              className="admin-element-c475d979c"
              data-node-id="2521:46455"
              data-name="Service incident log row"
            >
              <div
                className="admin-element-99291b251"
                data-node-id="2521:46456"
                data-name="Incident data"
              >
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46457"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Today, 14:18:04 WAT
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46458"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Payments & Escrow`}</p>
                <p
                  className="admin-element-b4a9cc2b5"
                  data-node-id="2521:46459"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  UP → DOWN
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46460"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Amaka Okonkwo
                </p>
                <p
                  className="admin-element-b4a9cc2b5"
                  data-node-id="2521:46461"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Active (28m)
                </p>
              </div>
              <div
                className="admin-element-3f60357e2"
                data-node-id="2521:46462"
                data-name="Divider"
              />
            </div>
            <div
              className="admin-element-c475d979c"
              data-node-id="2521:46463"
              data-name="Service incident log row"
            >
              <div
                className="admin-element-99291b251"
                data-node-id="2521:46464"
                data-name="Incident data"
              >
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46465"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Yesterday, 22:45:10 WAT
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46466"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`SMS & USSD Gateway`}</p>
                <p
                  className="admin-element-ce205e684"
                  data-node-id="2521:46467"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  MAINTENANCE
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46468"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Amaka Okonkwo
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46469"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  14 mins
                </p>
              </div>
              <div
                className="admin-element-3f60357e2"
                data-node-id="2521:46470"
                data-name="Divider"
              />
            </div>
            <div
              className="admin-element-c475d979c"
              data-node-id="2521:46471"
              data-name="Service incident log row"
            >
              <div
                className="admin-element-99291b251"
                data-node-id="2521:46472"
                data-name="Incident data"
              >
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46473"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  18 Oct, 09:12:33 WAT
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46474"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Logistics Dispatch
                </p>
                <p
                  className="admin-element-ce205e684"
                  data-node-id="2521:46475"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  DEGRADED → UP
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46476"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Amaka Okonkwo
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46477"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  42 mins
                </p>
              </div>
              <div
                className="admin-element-3f60357e2"
                data-node-id="2521:46478"
                data-name="Divider"
              />
            </div>
            <div
              className="admin-element-c475d979c"
              data-node-id="2521:46479"
              data-name="Service incident log row"
            >
              <div
                className="admin-element-99291b251"
                data-node-id="2521:46480"
                data-name="Incident data"
              >
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46481"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  15 Oct, 03:00:00 WAT
                </p>
                <Link
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46482"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  href="/admin/listings"
                >
                  Produce Listings
                </Link>
                <p
                  className="admin-element-ce205e684"
                  data-node-id="2521:46483"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  MAINTENANCE
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46484"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Automated Runbook
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46485"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  6 mins
                </p>
              </div>
              <div
                className="admin-element-3f60357e2"
                data-node-id="2521:46486"
                data-name="Divider"
              />
            </div>
            <div
              className="admin-element-c475d979c"
              data-node-id="2521:46487"
              data-name="Service incident log row"
            >
              <div
                className="admin-element-99291b251"
                data-node-id="2521:46488"
                data-name="Incident data"
              >
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46489"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  11 Oct, 18:30:19 WAT
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46490"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Payments & Escrow`}</p>
                <p
                  className="admin-element-ce205e684"
                  data-node-id="2521:46491"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  TEST → UP
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46492"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Amaka Okonkwo
                </p>
                <p
                  className="admin-element-624a4eb9d"
                  data-node-id="2521:46493"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  18 mins
                </p>
              </div>
              <div
                className="admin-element-3f60357e2"
                data-node-id="2521:46494"
                data-name="Divider"
              />
            </div>
            <div className="admin-element-63231d36d" data-node-id="2521:46495" data-name="Row">
              <p
                className="admin-element-e8492c51c"
                data-node-id="2521:46496"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                All operational transitions are cryptographically signed with Operations Key
                #LL-OPS-094
              </p>
              <p
                className="admin-element-e32eec764"
                data-node-id="2521:46497"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Audit engine: synced
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
