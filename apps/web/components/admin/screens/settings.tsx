import Link from "next/link";
import { AdminControl, AdminField, AdminDraftStatus } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgLagosMap = `${assetPathPrefix}/f5993.png`;
const imgApprovedIcon = `${assetPathPrefix}/1d14e.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/3159a.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/bbad0.svg`;
const imgArchive = `${assetPathPrefix}/22c79.svg`;
const imgTruck = `${assetPathPrefix}/aac1c.svg`;
const imgBarChart10 = `${assetPathPrefix}/c967f.svg`;
const imgTicket01 = `${assetPathPrefix}/4546e.svg`;
const imgSettings02 = `${assetPathPrefix}/a8876.svg`;
const imgSearchIcon = `${assetPathPrefix}/af369.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgHelpCircle = `${assetPathPrefix}/8ed5b.svg`;
const imgSettingsIcon = `${assetPathPrefix}/f3748.svg`;
const imgLockKeyholeSquare = `${assetPathPrefix}/bc220.svg`;
const imgHeadphones01 = `${assetPathPrefix}/d1acf.svg`;
const imgCircle = `${assetPathPrefix}/767b1.svg`;
export default function Component2701MarketplaceAndEscrowSettings() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:45421"
      data-name="27.01 · Marketplace and escrow settings"
    >
      <div className="admin-element-6a9160556" data-node-id="2521:45422" data-name="Staff sidebar">
        <div
          className="admin-element-47aacf6d1"
          data-node-id="2521:45423"
          data-name="Leetlogic identity"
        >
          <div
            className="admin-element-98312d2eb"
            data-node-id="2521:45424"
            data-name="Approved icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedIcon} />
          </div>
          <p className="admin-element-95dcd1624" data-node-id="2521:45427">
            Leetlogic
          </p>
        </div>
        <p
          className="admin-element-d850d511d"
          data-node-id="2521:45428"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          OPS PORTAL
        </p>
        <div
          className="admin-element-c49082262"
          data-node-id="2521:45429"
          data-name="Staff profile"
        >
          <div className="admin-element-47aacf6d1" data-node-id="2521:45430" data-name="Details">
            <div className="admin-element-fa034075d" data-node-id="2521:45431" data-name="Avatar">
              <p
                className="admin-element-98975eb29"
                data-node-id="2521:45432"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                A
              </p>
            </div>
            <div className="admin-element-d21287ddd" data-node-id="2521:45433" data-name="Identity">
              <p
                className="admin-element-08fd34b76"
                data-node-id="2521:45434"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Amaka
              </p>
              <p
                className="admin-element-ee7109148"
                data-node-id="2521:45435"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Operations Admin
              </p>
            </div>
          </div>
        </div>
        <div
          className="admin-element-fe2923e63"
          data-node-id="2521:45436"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45437"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45438"
              data-name="layout-alt-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45439"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45440"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45441"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45442"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45443"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45444" data-name="archive">
              <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45445"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45446"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45447" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45448"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Orders
            </span>
          </Link>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45449"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45450"
              data-name="bar-chart-10"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgBarChart10} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45451"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/reports"
            >
              Reports
            </Link>
          </div>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45452"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45453"
              data-name="ticket-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgTicket01} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45454"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Support`}</span>
          </Link>
          <Link
            className="admin-element-8168e843e"
            data-node-id="2521:45455"
            data-name="Navigation item"
            href="/admin/settings"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45456"
              data-name="settings-02"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgSettings02} />
            </div>
            <span
              className="admin-element-666310f2b"
              data-node-id="2521:45457"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Admin Settings
            </span>
          </Link>
        </div>
        <div className="admin-element-2858ff3cb" data-node-id="2521:45458" data-name="Session">
          <Link
            className="admin-element-9c5c77dce"
            data-node-id="2521:45459"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/login"
          >
            Log out
          </Link>
        </div>
      </div>
      <div
        className="admin-element-7c219a7f7"
        data-node-id="2521:45460"
        data-name="Staff workspace"
      >
        <div className="admin-element-5a294230a" data-node-id="2521:45461" data-name="Top bar">
          <div
            className="admin-element-7e8b60cc1"
            data-node-id="2521:45462"
            data-name="Search container"
          >
            <div className="admin-element-c45c17760" data-node-id="2521:45463" data-name="Search">
              <div
                className="admin-element-b2a182ecf"
                data-node-id="2521:45464"
                data-name="Search icon"
              >
                <img alt="" className="admin-element-8faf267d3" src={imgSearchIcon} />
              </div>
              <AdminField
                className="admin-element-db0bc8c58"
                data-node-id="2521:45465"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                label="Search ID, merchant, ticket, or batch..."
                search
              />
            </div>
          </div>
          <div className="admin-element-ad3903416" data-node-id="2521:45466" data-name="Status">
            <p
              className="admin-element-853146de1"
              data-node-id="2521:45467"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● System Active · Lagos DC
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:45468" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:45469"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <p
            className="admin-element-6570fff4b"
            data-node-id="2521:45470"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka
          </p>
        </div>
        <div
          className="admin-element-597aaf720"
          data-node-id="2521:45471"
          data-name="Workspace content"
        >
          <div
            className="admin-element-6d3824b80"
            data-node-id="2521:45472"
            data-name="Settings overview"
          >
            <p
              className="admin-element-4ca3fb38c"
              data-node-id="2521:45473"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Admin › System Configuration
            </p>
            <div className="admin-element-47aacf6d1" data-node-id="2521:45474" data-name="Details">
              <div
                className="admin-element-f2c414d8b"
                data-node-id="2521:45475"
                data-name="Heading"
              >
                <p
                  className="admin-element-a95deb81a"
                  data-node-id="2521:45476"
                >{`Marketplace & Escrow Settings`}</p>
                <p
                  className="admin-element-4c1fa568e"
                  data-node-id="2521:45477"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Configure platform fee structures, transaction hold windows, automated SLAs, and
                  operational support contacts.
                </p>
              </div>
              <div
                className="admin-element-e95742a1c"
                data-node-id="2521:45478"
                data-name="Environment"
              >
                <div
                  className="admin-element-d0d06bbd0"
                  data-node-id="2521:45479"
                  data-name="Status"
                >
                  <p
                    className="admin-element-5d78ec74b"
                    data-node-id="2521:45480"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Environment: Production (Lagos Cluster) · Last updated 3 days ago by Amaka
                    (STF-018)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-87601b9de"
            data-node-id="2521:45481"
            data-name="Settings and oversight"
          >
            <div
              className="admin-element-e1dd92e88"
              data-node-id="2521:45482"
              data-name="Policy settings"
            >
              <div
                className="admin-element-3577f8ab4"
                data-node-id="2521:45483"
                data-name="Commission setting module"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45484"
                  data-name="Details"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:45485"
                    data-name="Settings icon"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgSettingsIcon} />
                  </div>
                  <p
                    className="admin-element-c2f72defc"
                    data-node-id="2521:45486"
                  >{`Marketplace Commission & Fee Structure`}</p>
                  <div
                    className="admin-element-61426f31e"
                    data-node-id="2521:45487"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:45488"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Active Policy
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45489"
                  data-name="Details"
                >
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45490"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45491"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Platform Fee Percent
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45492"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45492;1091:63786"
                        data-name="_Input field base"
                        initialValue="6.0 %"
                        label="Platform Fee Percent"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45493"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Standard transaction commission deducted automatically upon buyer confirmation
                      before payout release.
                    </p>
                  </div>
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45494"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45495"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Export Processing Surcharge
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45496"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45496;1091:63786"
                        data-name="_Input field base"
                        initialValue="2.5 %"
                        label="Export Processing Surcharge"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45497"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Applied to cross-border orders requiring phytosanitary and export clearance
                      support.
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-3577f8ab4"
                data-node-id="2521:45498"
                data-name="Hold setting module"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45499"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:45500"
                    data-name="lock-keyhole-square"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgLockKeyholeSquare} />
                  </div>
                  <p
                    className="admin-element-c2f72defc"
                    data-node-id="2521:45501"
                  >{`Escrow & Settlement Windows`}</p>
                  <p
                    className="admin-element-0011b0bee"
                    data-node-id="2521:45502"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    SLA Rules
                  </p>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45503"
                  data-name="Details"
                >
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45504"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45505"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Escrow Hold Window
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45506"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45506;1091:63786"
                        data-name="_Input field base"
                        initialValue="3 Days"
                        label="Escrow Hold Window"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45507"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Period buyer has to inspect produce and lodge dispute before funds
                      auto-release to farmer wallet.
                    </p>
                  </div>
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45508"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45509"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Dispute Grace Period
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45510"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45510;1091:63786"
                        data-name="_Input field base"
                        initialValue="24 Hours"
                        label="Dispute Grace Period"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45511"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Time window allowed for farmer to submit counter-evidence for damaged goods.
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-3577f8ab4"
                data-node-id="2521:45512"
                data-name="Emergency and support contacts"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45513"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:45514"
                    data-name="headphones-01"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgHeadphones01} />
                  </div>
                  <p
                    className="admin-element-c2f72defc"
                    data-node-id="2521:45515"
                  >{`Emergency & Support Contacts`}</p>
                  <p
                    className="admin-element-0011b0bee"
                    data-node-id="2521:45516"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Public Routing
                  </p>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45517"
                  data-name="Details"
                >
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45518"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45519"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Support Phone Number
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45520"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45520;1091:63786"
                        data-name="_Input field base"
                        initialValue="+234 800 533 8564"
                        label="Support Phone Number"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45521"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Primary voice escalation hotline displayed in farmer and buyer apps for urgent
                      dispatch and delivery issues.
                    </p>
                  </div>
                  <div
                    className="admin-element-57ac4716f"
                    data-node-id="2521:45522"
                    data-name="Setting field"
                  >
                    <p
                      className="admin-element-b299185c1"
                      data-node-id="2521:45523"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Support Escalation Email
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:45524"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:45524;1091:63786"
                        data-name="_Input field base"
                        initialValue="ops-escalations@leetlogi…"
                        label="Support Escalation Email"
                      />
                    </div>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45525"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Direct escalation inbox monitored 24/7 by the Lagos central fulfillment
                      control room.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-98321dc9a"
              data-node-id="2521:45526"
              data-name="Operational oversight"
            >
              <div
                className="admin-element-94e1aa569"
                data-node-id="2521:45527"
                data-name="Audit summary"
              >
                <p className="admin-element-f6b7edd74" data-node-id="2521:45528">
                  Audit Summary
                </p>
                <p
                  className="admin-element-aaa436472"
                  data-node-id="2521:45529"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Adjusting escrow hold windows retroactively does not apply to active settlements
                  already verified by hauler telemetry.
                </p>
                <div
                  className="admin-element-fb8ba7193"
                  data-node-id="2521:45530"
                  data-name="Escrow audit metric"
                >
                  <div
                    className="admin-element-c6d2d846f"
                    data-node-id="2521:45531"
                    data-name="Details"
                  >
                    <p
                      className="admin-element-28e0cf831"
                      data-node-id="2521:45532"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Pending Disbursements
                    </p>
                    <p className="admin-element-6aed01eda" data-node-id="2521:45533">
                      ₦48.2M
                    </p>
                  </div>
                  <div
                    className="admin-element-c2ecf0a11"
                    data-node-id="2521:45534"
                    data-name="Details"
                  >
                    <p
                      className="admin-element-4a9b73a3b"
                      data-node-id="2521:45535"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Active Orders In-Escrow
                    </p>
                    <p
                      className="admin-element-af214b0cf"
                      data-node-id="2521:45536"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      142 Batches
                    </p>
                  </div>
                  <div
                    className="admin-element-43743f9c8"
                    data-node-id="2521:45537"
                    data-name="Audit progress"
                  >
                    <div
                      className="admin-element-928f5b592"
                      data-node-id="2521:45538"
                      data-name="Active share"
                    />
                  </div>
                </div>
              </div>
              <div
                className="admin-element-94e1aa569"
                data-node-id="2521:45539"
                data-name="Security authorization"
              >
                <p className="admin-element-f6b7edd74" data-node-id="2521:45540">
                  Security Authorization
                </p>
                <p
                  className="admin-element-f0f03052c"
                  data-node-id="2521:45541"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Changes to platform fee or settlement duration notify all registered cooperative
                  managers via SMS dispatch.
                </p>
                <div
                  className="admin-element-ae9c6358c"
                  data-node-id="2521:45542"
                  data-name="Authorization requirement"
                >
                  <p
                    className="admin-element-f0f03052c"
                    data-node-id="2521:45543"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    2FA Operations Pin Required at submit
                  </p>
                </div>
              </div>
              <div
                className="admin-element-fa2aea108"
                data-node-id="2521:45544"
                data-name="Operations hub"
              >
                <p
                  className="admin-element-011e9cabb"
                  data-node-id="2521:45545"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  OPERATIONS HUB
                </p>
                <p className="admin-element-f5f5f67f8" data-node-id="2521:45546">
                  Lagos Clearing Center
                </p>
                <p
                  className="admin-element-8fae4a003"
                  data-node-id="2521:45547"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Direct connection to Mile 12 Terminal & Tin Can Port logistics gate.`}</p>
                <div
                  className="admin-element-848a81b15"
                  data-node-id="2521:45548"
                  data-name="Lagos map"
                >
                  <div className="admin-element-45d68c69e">
                    <img alt="" className="admin-element-eb820df55" src={imgLagosMap} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-ecfa56617"
            data-node-id="2521:45549"
            data-name="Save settings"
          >
            <div className="admin-element-47aacf6d1" data-node-id="2521:45550" data-name="Details">
              <div className="admin-element-8a0ff4892" data-node-id="2521:45551" data-name="circle">
                <img alt="" className="admin-element-8faf267d3" src={imgCircle} />
              </div>
              <AdminDraftStatus
                className="admin-element-b109a6467"
                data-node-id="2521:45552"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              />
              <AdminControl
                className="admin-element-ec95c5192"
                data-node-id="2521:45553"
                data-name="Secondary action"
              >
                <p
                  className="admin-element-ccf92a798"
                  data-node-id="2521:45554"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Reset to Defaults
                </p>
              </AdminControl>
              <AdminControl
                className="admin-element-f38a6df36"
                data-node-id="2521:45555"
                data-name="Primary action"
              >
                <div
                  className="admin-element-4713e3706"
                  data-node-id="I2521:45555;2521:20144"
                  data-name="Button:shadow"
                />
                <div
                  className="admin-element-9a39a55c2"
                  data-node-id="I2521:45555;2521:20145"
                  data-name="Container"
                >
                  <div
                    className="admin-element-a47f45dc6"
                    data-node-id="I2521:45555;2521:20146"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <p className="admin-element-f62dcabf0">Save Changes</p>
                  </div>
                </div>
              </AdminControl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
