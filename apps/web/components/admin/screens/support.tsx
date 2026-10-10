import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgOpenFalseSupportingTextFalseTooltipTopArrow = `${assetPathPrefix}/a26a3.svg`;
const imgOriginalPhoto = `${assetPathPrefix}/521bd.png`;
const imgApprovedIcon = `${assetPathPrefix}/a1d6d.svg`;
const imgApprovedWordmark = `${assetPathPrefix}/b71a2.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/4fdf3.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/e5209.svg`;
const imgTruck = `${assetPathPrefix}/509af.svg`;
const imgTicket02 = `${assetPathPrefix}/25b5d.svg`;
const imgMessageSquare = `${assetPathPrefix}/3b6fc.svg`;
const imgShieldOff = `${assetPathPrefix}/91b2b.svg`;
const imgTranslate02 = `${assetPathPrefix}/86884.svg`;
const imgSettings = `${assetPathPrefix}/961df.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgHelpCircle = `${assetPathPrefix}/8ed5b.svg`;
const imgChevronDown = `${assetPathPrefix}/a811f.svg`;
const imgArrowDown = `${assetPathPrefix}/933a1.svg`;
type HelpIconProps = {
  className?: string;
  open?: "False";
  supportingText?: "False";
  tooltip?: "Top arrow";
};
function HelpIcon({
  className,
  open = "False",
  supportingText = "False",
  tooltip = "Top arrow",
}: HelpIconProps) {
  return (
    <div className={className || "admin-element-f14442793"} data-node-id="2117:72993">
      <img
        alt=""
        className="admin-element-8faf267d3"
        src={imgOpenFalseSupportingTextFalseTooltipTopArrow}
      />
    </div>
  );
}
export default function Component2101SupportDisputeTicketQueue() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:43221"
      data-name="21.01 · Support & dispute ticket queue"
    >
      <div className="admin-element-b5faaf4f0" data-node-id="2521:43222" data-name="Staff sidebar">
        <div
          className="admin-element-62f0e5146"
          data-node-id="2521:43223"
          data-name="Approved Leetlogic logo"
        >
          <div
            className="admin-element-f84de7678"
            data-node-id="2521:43224"
            data-name="Approved icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedIcon} />
          </div>
          <div
            className="admin-element-35936b362"
            data-node-id="2521:43227"
            data-name="Approved wordmark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedWordmark} />
          </div>
        </div>
        <p
          className="admin-element-321db6ddc"
          data-node-id="2521:43237"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Admin Portal
        </p>
        <div className="admin-element-0ae70feb3" data-node-id="2521:43238" data-name="Card">
          <p
            className="admin-element-923b1ee42"
            data-node-id="2521:43239"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka
          </p>
          <Link
            className="admin-element-f57c10294"
            data-node-id="2521:43240"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/support"
          >
            Operations / Support O...
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43241" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43242"
            data-name="layout-alt-01"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43243"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43244" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43245"
            data-name="check-verified-03"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43246"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/verification"
          >
            Verification Queue
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43247" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43248" data-name="truck">
            <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43249"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/orders"
          >
            Orders
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43250" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43251" data-name="ticket-02">
            <img alt="" className="admin-element-8faf267d3" src={imgTicket02} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43252"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/disputes"
          >{`Disputes & Tickets`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43253" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43254"
            data-name="message-square"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgMessageSquare} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43255"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/support/chat"
          >
            Live Chat Console
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43256" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43257" data-name="shield-off">
            <img alt="" className="admin-element-8faf267d3" src={imgShieldOff} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43258"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/risk"
          >{`Fraud & Risk`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43259" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43260"
            data-name="translate-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgTranslate02} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43261"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/translations"
          >{`Localization & Translations`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43262" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43263" data-name="settings">
            <img alt="" className="admin-element-8faf267d3" src={imgSettings} />
          </div>
          <Link
            className="admin-element-1da7c5f12"
            data-node-id="2521:43264"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/settings"
          >
            Staff Settings
          </Link>
        </div>
        <div
          className="admin-element-3bb6fcb9c"
          data-node-id="2521:43265"
          data-name="Sidebar footer"
        >
          <p
            className="admin-element-1ffe61c97"
            data-node-id="2521:43266"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >{`● Market v2.4 Active        ↪`}</p>
        </div>
      </div>
      <div
        className="admin-element-692397f10"
        data-node-id="2521:43267"
        data-name="Staff workspace"
      >
        <div className="admin-element-47aacf6d1" data-node-id="2521:43268" data-name="Details">
          <div className="admin-element-41f6217fb" data-node-id="2521:43269" data-name="Status">
            <p
              className="admin-element-ba6c094ce"
              data-node-id="2521:43270"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● Systems Normal · 99.98%
            </p>
          </div>
          <div className="admin-element-67ff6b3ae" data-node-id="2521:43271" data-name="Card">
            <p
              className="admin-element-aaa436472"
              data-node-id="2521:43272"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ⌕ Search ID, merchant, ticket, or batch...
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:43273" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43274"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <div
            className="admin-element-31af2dfd6"
            data-node-id="2521:43275"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            <p className="admin-element-96eff31b5">Amaka O.</p>
            <p className="admin-element-a4d2b1ada">Shift Lead</p>
          </div>
        </div>
        <p
          className="admin-element-5297013ff"
          data-node-id="2521:43276"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >{`⚒ Arbitration & Customer Care Ops / Live Queue v2.4`}</p>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43277" data-name="Details">
          <div
            className="admin-element-b4eb3a1ea"
            data-node-id="2521:43278"
            data-name="Queue title"
          >
            <p
              className="admin-element-c88df0dc9"
              data-node-id="2521:43279"
            >{`Support & Dispute Ticket Queue`}</p>
            <p
              className="admin-element-697811072"
              data-node-id="2521:43280"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Customer support tickets, dispute arbitrations and escalation workflows
            </p>
          </div>
          <div
            className="admin-element-b51bd6192"
            data-node-id="2521:43281"
            data-name="Queue statistics"
          >
            <div className="admin-element-6c708945f" data-node-id="2521:43282" data-name="Status">
              <p
                className="admin-element-ba6c094ce"
                data-node-id="2521:43283"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Open Tickets: 8
              </p>
            </div>
            <div className="admin-element-6c708945f" data-node-id="2521:43284" data-name="Status">
              <p
                className="admin-element-ba6c094ce"
                data-node-id="2521:43285"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Awaiting Officer: 3
              </p>
            </div>
            <div className="admin-element-6c708945f" data-node-id="2521:43286" data-name="Status">
              <p
                className="admin-element-ba6c094ce"
                data-node-id="2521:43287"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Resolved Today: 24
              </p>
            </div>
            <div className="admin-element-6c708945f" data-node-id="2521:43288" data-name="Status">
              <p
                className="admin-element-ba6c094ce"
                data-node-id="2521:43289"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Avg Response Time: 18m
              </p>
            </div>
          </div>
        </div>
        <div
          className="admin-element-c93a8f5ce"
          data-node-id="2521:43290"
          data-name="Tickets and operations"
        >
          <div className="admin-element-e5d5ae9c3" data-node-id="2521:43291" data-name="Queue">
            <div className="admin-element-021a7a056" data-node-id="2521:43292" data-name="Card">
              <div
                className="admin-element-47aacf6d1"
                data-node-id="2521:43293"
                data-name="Details"
              >
                <div
                  className="admin-element-93a863fa2"
                  data-node-id="2521:43294"
                  data-name="Ticket filters"
                >
                  <div
                    className="admin-element-429d47e3a"
                    data-node-id="2521:43295"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-083974024"
                      data-node-id="2521:43296"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      All Tickets (32)
                    </p>
                  </div>
                  <div
                    className="admin-element-41f6217fb"
                    data-node-id="2521:43297"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-b211b207e"
                      data-node-id="2521:43298"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Open (8)
                    </p>
                  </div>
                  <div
                    className="admin-element-41f6217fb"
                    data-node-id="2521:43299"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-b211b207e"
                      data-node-id="2521:43300"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      In Progress (5)
                    </p>
                  </div>
                  <div
                    className="admin-element-41f6217fb"
                    data-node-id="2521:43301"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-b211b207e"
                      data-node-id="2521:43302"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Closed (19)
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-3633d0170"
                  data-node-id="2521:43303"
                  data-name="Search and category"
                >
                  <div
                    className="admin-element-40e1a6f5e"
                    data-node-id="2521:43304"
                    data-name="Card"
                  >
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:43305"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      ⌕ Search ticket number, customer phone, order
                    </p>
                  </div>
                  <div
                    className="admin-element-a1401a362"
                    data-node-id="2521:43306"
                    data-name="Selection"
                  >
                    <AdminField
                      className="admin-element-51368a6cd"
                      data-node-id="I2521:43306;1096:13994"
                      data-name="_Select input base"
                      initialValue="All Categories (Delivery, Payment, Quality, Account)"
                      label="⚒ Arbitration & Customer Care Ops / Live Queue v2.4"
                      select
                    />
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-58d9b16a9"
              data-node-id="2521:43307"
              data-name="Staff ticket table specimen"
            >
              <div
                className="admin-element-eaedce306"
                data-node-id="I2521:43307;1227:108549"
                data-name="Content"
              >
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43307;1225:108376"
                  data-name="Column"
                >
                  <div
                    className="admin-element-47a7309de"
                    data-node-id="I2521:43307;1224:5566"
                    data-name="Table header cell"
                  >
                    <div
                      className="admin-element-484a41d44"
                      data-node-id="I2521:43307;1224:5566;1221:107935"
                      data-name="Table header"
                    >
                      <p
                        className="admin-element-031e0bf69"
                        data-node-id="I2521:43307;1224:5566;1221:107935;1221:106781"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >{`Ticket & issue`}</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108334"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1225:108334;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">#2041 · QUALITY</p>
                      <p className="admin-element-6a1cd3fb3">Damaged Roma tomatoes on arrival</p>
                      <p className="admin-element-cbe0e8fc4">Created 28m ago via Buyer App</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108388"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1225:108388;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">#1988 · PAYMENT</p>
                      <p className="admin-element-6a1cd3fb3">
                        Payout confirmation delay to Kuda Bank
                      </p>
                      <p className="admin-element-cbe0e8fc4">Created 4h ago · Web Merchant</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:1"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1226:1;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">#2039 · LOGISTICS</p>
                      <p className="admin-element-6a1cd3fb3">
                        Driver delayed at Benin-Ore expressway
                      </p>
                      <p className="admin-element-cbe0e8fc4">Created 58m ago · GPS Ping</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:9"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1226:9;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">#1985 · CATALOG</p>
                      <p className="admin-element-6a1cd3fb3">
                        Produce variety mismatch (Plum vs Beefsteak)
                      </p>
                      <p className="admin-element-cbe0e8fc4">Created yesterday · WhatsApp Bot</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43307;1225:108377"
                  data-name="Column"
                >
                  <div
                    className="admin-element-a5849317e"
                    data-node-id="I2521:43307;1224:5575"
                    data-name="Table header cell"
                  >
                    <div
                      className="admin-element-9fa633d05"
                      data-node-id="I2521:43307;1224:5575;1224:4551"
                      data-name="Table header"
                    >
                      <p
                        className="admin-element-031e0bf69"
                        data-node-id="I2521:43307;1224:5575;1224:4551;1221:106889"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >{`Stakeholder & order`}</p>
                      <div
                        className="admin-element-c51752dc8"
                        data-node-id="I2521:43307;1224:5575;1224:4551;1221:106890"
                        data-name="arrow-down"
                      >
                        <img alt="" className="admin-element-8faf267d3" src={imgArrowDown} />
                      </div>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108335"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1225:108335;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Folake Adebayo</p>
                      <p className="admin-element-6a1cd3fb3">#BYR-1029</p>
                      <p className="admin-element-cbe0e8fc4">Order #LL-8921 · ₦38,000</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1227:122229"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1227:122229;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Sunday Eze</p>
                      <p className="admin-element-6a1cd3fb3">#FRM-3801</p>
                      <p className="admin-element-cbe0e8fc4">Order #LL-8704 · ₦19,500</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1227:122235"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1227:122235;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Ikeja Foods Hub</p>
                      <p className="admin-element-6a1cd3fb3">#BYR-4421</p>
                      <p className="admin-element-cbe0e8fc4">Order #LL-8910 · ₦142,000</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1227:122241"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1227:122241;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Mama Put Kitchen</p>
                      <p className="admin-element-6a1cd3fb3">#BYR-0899</p>
                      <p className="admin-element-cbe0e8fc4">Order #LL-8690 · ₦24,000</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43307;1225:108378"
                  data-name="Column"
                >
                  <div
                    className="admin-element-a5849317e"
                    data-node-id="I2521:43307;1224:5797"
                    data-name="Table header cell"
                  >
                    <div
                      className="admin-element-9fa633d05"
                      data-node-id="I2521:43307;1224:5797;1224:4551"
                      data-name="Table header"
                    >
                      <p
                        className="admin-element-031e0bf69"
                        data-node-id="I2521:43307;1224:5797;1224:4551;1221:106790"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Priority / SLA
                      </p>
                      <HelpIcon className="admin-element-c51752dc8" />
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108336"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-3a8640702"
                      data-node-id="I2521:43307;1225:108336;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Urgent (SLA 32m left)
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108402"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1225:108402;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Standard
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:164"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-47a513901"
                      data-node-id="I2521:43307;1226:164;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      High (SLA 1h 14m)
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:166"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1226:166;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Normal
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43307;1225:108385"
                  data-name="Column"
                >
                  <div
                    className="admin-element-a5849317e"
                    data-node-id="I2521:43307;1224:5800"
                    data-name="Table header cell"
                  >
                    <div
                      className="admin-element-5a14dac53"
                      data-node-id="I2521:43307;1224:5800;1224:4551"
                      data-name="Table header"
                    >
                      <p
                        className="admin-element-031e0bf69"
                        data-node-id="I2521:43307;1224:5800;1224:4551;1221:106781"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Status
                      </p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108337"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1225:108337;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Open
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108404"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1225:108404;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Closed
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:188"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1226:188;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Open
                    </p>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:190"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-cc37ca176"
                      data-node-id="I2521:43307;1226:190;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Closed
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43307;1225:108386"
                  data-name="Column"
                >
                  <div
                    className="admin-element-a5849317e"
                    data-node-id="I2521:43307;1224:5850"
                    data-name="Table header cell"
                  >
                    <div
                      className="admin-element-5a14dac53"
                      data-node-id="I2521:43307;1224:5850;1224:4551"
                      data-name="Table header"
                    >
                      <p
                        className="admin-element-031e0bf69"
                        data-node-id="I2521:43307;1224:5850;1224:4551;1221:106781"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Assigned
                      </p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1225:108338"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1225:108338;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Amaka Okonkwo</p>
                      <p className="admin-element-cbe0e8fc4">AO · Tier-2 Ops Lead</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:216"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1226:216;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Amaka O.</p>
                      <p className="admin-element-cbe0e8fc4">Resolved 2h ago</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:232"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1226:232;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Chinedu E.</p>
                      <p className="admin-element-cbe0e8fc4">CE · Transit Dispatch</p>
                    </div>
                  </div>
                  <div
                    className="admin-element-fe0667641"
                    data-node-id="I2521:43307;1226:248"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-def83b01a"
                      data-node-id="I2521:43307;1226:248;1223:41"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-6a1cd3fb3">Musa B.</p>
                      <p className="admin-element-cbe0e8fc4">Full credit voucher</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-element-ce47c3263" data-node-id="2521:43308" data-name="Card">
              <div
                className="admin-element-f2596f5c7"
                data-node-id="2521:43309"
                data-name="Details"
              >
                <p
                  className="admin-element-6c19a635e"
                  data-node-id="2521:43310"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Showing 1-4 of 32 tickets • Page 1 of 8
                </p>
                <p
                  className="admin-element-fc2fb9645"
                  data-node-id="2521:43311"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`‹   1   2   3   ...   8   ›`}</p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-c22041e77"
            data-node-id="2521:43312"
            data-name="Operations panels"
          >
            <div className="admin-element-1f48bb97b" data-node-id="2521:43313" data-name="Card">
              <div
                className="admin-element-303107dfb"
                data-node-id="2521:43314"
                data-name="Details"
              >
                <p
                  className="admin-element-e8492c51c"
                  data-node-id="2521:43315"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  SLA Benchmark
                </p>
                <p
                  className="admin-element-5deb5066d"
                  data-node-id="2521:43316"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Shift: Morning
                </p>
              </div>
              <div className="admin-element-4ac984190" data-node-id="2521:43317" data-name="Card">
                <div
                  className="admin-element-303107dfb"
                  data-node-id="2521:43318"
                  data-name="Details"
                >
                  <p
                    className="admin-element-e8492c51c"
                    data-node-id="2521:43319"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    First Contact Resolution
                  </p>
                  <p
                    className="admin-element-5deb5066d"
                    data-node-id="2521:43320"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    88%
                  </p>
                </div>
                <div
                  className="admin-element-d226f4a2f"
                  data-node-id="2521:43321"
                  data-name="Resolution progress"
                >
                  <div
                    className="admin-element-f2ee0ce4b"
                    data-node-id="2521:43322"
                    data-name="Resolution value"
                  />
                </div>
                <p
                  className="admin-element-9a29b649b"
                  data-node-id="2521:43323"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Goal: ≥85% compliance
                </p>
              </div>
              <div className="admin-element-597e4a925" data-node-id="2521:43324" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43325"
                  data-name="Details"
                >
                  <p
                    className="admin-element-e8492c51c"
                    data-node-id="2521:43326"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Priority Queue Target
                  </p>
                  <p
                    className="admin-element-0bba51d9e"
                    data-node-id="2521:43327"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`< 45m`}</p>
                </div>
                <div
                  className="admin-element-77ac1a8a3"
                  data-node-id="2521:43328"
                  data-name="Details"
                >
                  <p
                    className="admin-element-6c19a635e"
                    data-node-id="2521:43329"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Current Median
                  </p>
                  <p
                    className="admin-element-34694573d"
                    data-node-id="2521:43330"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    18m 20s
                  </p>
                </div>
              </div>
              <p
                className="admin-element-0b2f31b70"
                data-node-id="2521:43331"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Active Arbitrators
              </p>
              <div
                className="admin-element-f2596f5c7"
                data-node-id="2521:43332"
                data-name="Details"
              >
                <p
                  className="admin-element-6c19a635e"
                  data-node-id="2521:43333"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Amaka Okonkwo (You)
                </p>
                <p
                  className="admin-element-34694573d"
                  data-node-id="2521:43334"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  3 handling
                </p>
              </div>
              <div
                className="admin-element-f2596f5c7"
                data-node-id="2521:43335"
                data-name="Details"
              >
                <p
                  className="admin-element-6c19a635e"
                  data-node-id="2521:43336"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Chinedu E.
                </p>
                <p
                  className="admin-element-34694573d"
                  data-node-id="2521:43337"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  2 handling
                </p>
              </div>
              <div
                className="admin-element-f2596f5c7"
                data-node-id="2521:43338"
                data-name="Details"
              >
                <p
                  className="admin-element-6c19a635e"
                  data-node-id="2521:43339"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Musa B.
                </p>
                <p
                  className="admin-element-34694573d"
                  data-node-id="2521:43340"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  1 handling
                </p>
              </div>
            </div>
            <div className="admin-element-1f48bb97b" data-node-id="2521:43341" data-name="Card">
              <p
                className="admin-element-2f69378f3"
                data-node-id="2521:43342"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                ⚡ Emergency Escalation
              </p>
              <p
                className="admin-element-f0f03052c"
                data-node-id="2521:43343"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                In transit perishable rot or cold-chain breakdown on Interstate transit corridors.
              </p>
              <AdminControl
                className="admin-element-834dc2dc7"
                data-node-id="2521:43344"
                data-name="Transit alert action"
              >
                <p
                  className="admin-element-607ad4a1c"
                  data-node-id="2521:43345"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Trigger Transit Alert
                </p>
              </AdminControl>
            </div>
            <div className="admin-element-1f48bb97b" data-node-id="2521:43346" data-name="Card">
              <div
                className="admin-element-f2596f5c7"
                data-node-id="2521:43347"
                data-name="Details"
              >
                <p
                  className="admin-element-6c19a635e"
                  data-node-id="2521:43348"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Evidence Intake
                </p>
                <p
                  className="admin-element-34694573d"
                  data-node-id="2521:43349"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ▣
                </p>
              </div>
              <div
                className="admin-element-2410d0e42"
                data-node-id="2521:43350"
                data-name="Original photo"
              >
                <div className="admin-element-7ae6a058a">
                  <img alt="" className="admin-element-76d74492e" src={imgOriginalPhoto} />
                </div>
              </div>
              <div className="admin-element-d604c2d6d" data-node-id="2521:43351" data-name="Status">
                <p
                  className="admin-element-083974024"
                  data-node-id="2521:43352"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Attachment #2041-A
                </p>
              </div>
              <p
                className="admin-element-a44744795"
                data-node-id="2521:43353"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Tomatoes_transit_waybill...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
