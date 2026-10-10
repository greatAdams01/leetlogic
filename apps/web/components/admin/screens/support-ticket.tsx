import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgReferencePhoto = `${assetPathPrefix}/d90ce.png`;
const imgLayoutGrid02 = `${assetPathPrefix}/4bbe1.svg`;
const imgTruck = `${assetPathPrefix}/95194.svg`;
const imgShieldOff = `${assetPathPrefix}/80235.svg`;
const imgSearch = `${assetPathPrefix}/2ca73.svg`;
const imgUserCircle = `${assetPathPrefix}/8d4b4.svg`;
const imgArrowLeft = `${assetPathPrefix}/8c950.svg`;
const imgClockRewind = `${assetPathPrefix}/5f09a.svg`;
const imgShieldOff1 = `${assetPathPrefix}/009b0.svg`;
const imgPaperclip = `${assetPathPrefix}/bfc25.svg`;
const imgImage = `${assetPathPrefix}/d7972.svg`;
export default function Component2103SupportWorkspace() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:43521"
      data-name="21.03 · Support workspace"
    >
      <div
        className="admin-element-c74b06084"
        data-node-id="2521:43522"
        data-name="Staff navigation"
      >
        <p className="admin-element-0beefa202" data-node-id="2521:43523">
          Leetlogic
        </p>
        <p
          className="admin-element-66df30e07"
          data-node-id="2521:43524"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Admin Portal
        </p>
        <div className="admin-element-63c5107b2" data-node-id="2521:43525" data-name="Divider" />
        <p
          className="admin-element-cf33caea8"
          data-node-id="2521:43526"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Amaka
        </p>
        <Link
          className="admin-element-66df30e07"
          data-node-id="2521:43527"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          href="/admin/support"
        >
          Operations / Support O...
        </Link>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43528" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43529"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43530"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43531" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43532"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43533"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/verification"
          >
            Verification Queue
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43534" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43535" data-name="truck">
            <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43536"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/orders"
          >
            Orders
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43537" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43538"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43539"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/disputes"
          >{`Disputes & Tickets`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43540" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43541"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43542"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/support/chat"
          >
            Live Chat Console
          </Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43543" data-name="Details">
          <div className="admin-element-35368e319" data-node-id="2521:43544" data-name="shield-off">
            <img alt="" className="admin-element-8faf267d3" src={imgShieldOff} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43545"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/risk"
          >{`Fraud & Risk`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43546" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43547"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43548"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/translations"
          >{`Localization & Translations`}</Link>
        </div>
        <div className="admin-element-47aacf6d1" data-node-id="2521:43549" data-name="Details">
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43550"
            data-name="layout-grid-02"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid02} />
          </div>
          <Link
            className="admin-element-8a887b73e"
            data-node-id="2521:43551"
            style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            href="/admin/settings"
          >
            Staff Settings
          </Link>
        </div>
        <div
          className="admin-element-a978bf69b"
          data-node-id="2521:43552"
          data-name="Navigation spacer"
        />
        <p
          className="admin-element-66df30e07"
          data-node-id="2521:43553"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          ● Market v2.4 Active
        </p>
      </div>
      <div className="admin-element-3d7de8083" data-node-id="2521:43554" data-name="Staff main">
        <div
          className="admin-element-bf950a4ba"
          data-node-id="2521:43555"
          data-name="Staff toolbar"
        >
          <div
            className="admin-element-852ad9382"
            data-node-id="2521:43556"
            data-name="Status badge"
          >
            <p
              className="admin-element-3bf909f93"
              data-node-id="2521:43557"
              style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
            >
              ● Systems Normal · 99.98%
            </p>
          </div>
          <div
            className="admin-element-a2fbf29ff"
            data-node-id="2521:43558"
            data-name="Staff search"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43559" data-name="search">
              <img alt="" className="admin-element-8faf267d3" src={imgSearch} />
            </div>
            <AdminField
              className="admin-element-0600f90f6"
              data-node-id="2521:43560"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              label="Search ID, merchant, ticket, or batch..."
              search
            />
          </div>
          <p
            className="admin-element-56a5174ea"
            data-node-id="2521:43561"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka O.\nShift Lead
          </p>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43562"
            data-name="user-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgUserCircle} />
          </div>
        </div>
        <div className="admin-element-acb1d9a77" data-node-id="2521:43563" data-name="Workspace">
          <div className="admin-element-47aacf6d1" data-node-id="2521:43564" data-name="Details">
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43565"
              data-name="arrow-left"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgArrowLeft} />
            </div>
            <p
              className="admin-element-ca798ffb8"
              data-node-id="2521:43566"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Tickets  •`}</p>
            <p className="admin-element-94bfb519d" data-node-id="2521:43567">
              Ticket #2041
            </p>
            <div
              className="admin-element-179b1befe"
              data-node-id="2521:43568"
              data-name="Status badge"
            >
              <p
                className="admin-element-7b3f82a44"
                data-node-id="2521:43569"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                HIGH PRIORITY
              </p>
            </div>
            <div
              className="admin-element-0ce0ef522"
              data-node-id="2521:43570"
              data-name="Status badge"
            >
              <p
                className="admin-element-dccb5d179"
                data-node-id="2521:43571"
                style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
              >
                Open
              </p>
            </div>
            <p
              className="admin-element-56a5174ea"
              data-node-id="2521:43572"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ◷ SLA Target: 42m remaining
            </p>
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43573"
              data-name="clock-rewind"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgClockRewind} />
            </div>
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43574"
              data-name="shield-off"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgShieldOff1} />
            </div>
          </div>
          <div
            className="admin-element-b13473824"
            data-node-id="2521:43575"
            data-name="Case workspace columns"
          >
            <div
              className="admin-element-6ff5d0960"
              data-node-id="2521:43576"
              data-name="Case context and evidence"
            >
              <div
                className="admin-element-ed0d4bead"
                data-node-id="2521:43577"
                data-name="Issue summary"
              >
                <div
                  className="admin-element-343a8b950"
                  data-node-id="2521:43578"
                  data-name="Details"
                >
                  <p
                    className="admin-element-8cb90d4b1"
                    data-node-id="2521:43579"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Issue Category
                  </p>
                  <p
                    className="admin-element-4a9b73a3b"
                    data-node-id="2521:43580"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Transit Damage · Mile 12 Hub
                  </p>
                </div>
                <p className="admin-element-840e049aa" data-node-id="2521:43581">
                  Damaged Roma tomatoes upon delivery at Mile 12 Hub
                </p>
                <p
                  className="admin-element-59b49b510"
                  data-node-id="2521:43582"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ⌖ Inbound logistics: Ebonyi → Mile 12, Lagos
                </p>
              </div>
              <div
                className="admin-element-cbdb01462"
                data-node-id="2521:43583"
                data-name="Case parties"
              >
                <div
                  className="admin-element-57825df78"
                  data-node-id="2521:43584"
                  data-name="Buyer complainant"
                >
                  <p
                    className="admin-element-5a7d6aeb8"
                    data-node-id="2521:43585"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ♧ Buyer (Complainant)
                  </p>
                  <p
                    className="admin-element-c082243aa"
                    data-node-id="2521:43586"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    Folake Adeb...
                  </p>
                  <p
                    className="admin-element-59b49b510"
                    data-node-id="2521:43587"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Retail Grocer, Lagos
                  </p>
                  <p
                    className="admin-element-5a7d6aeb8"
                    data-node-id="2521:43588"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ☆ 4.9 (42 deals)
                  </p>
                </div>
                <div
                  className="admin-element-b3c382a1b"
                  data-node-id="2521:43589"
                  data-name="Produce grower"
                >
                  <p
                    className="admin-element-66c5136e9"
                    data-node-id="2521:43590"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ♧ Produce Grower
                  </p>
                  <p
                    className="admin-element-0c99a8dad"
                    data-node-id="2521:43591"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    Chibuzor Si...
                  </p>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43592"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Ikwo LGA, Ebonyi State
                  </p>
                  <p
                    className="admin-element-2340158b1"
                    data-node-id="2521:43593"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ◉ Tier 1 Verified
                  </p>
                </div>
              </div>
              <div
                className="admin-element-c6f31dcac"
                data-node-id="2521:43594"
                data-name="Staff evidence & case feed"
              >
                <div
                  className="admin-element-5414d55e2"
                  data-node-id="2521:43595"
                  data-name="Details"
                >
                  <p
                    className="admin-element-b7986f795"
                    data-node-id="2521:43596"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >{`Evidence & Case Feed`}</p>
                  <p
                    className="admin-element-f321f4990"
                    data-node-id="2521:43597"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    2 Updates
                  </p>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43598"
                  data-name="Divider"
                />
                <div
                  className="admin-element-3e2431202"
                  data-node-id="2521:43599"
                  data-name="Buyer evidence"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:43600"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-0ce0ef522"
                      data-node-id="2521:43601"
                      data-name="Status badge"
                    >
                      <p
                        className="admin-element-dccb5d179"
                        data-node-id="2521:43602"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >
                        FA
                      </p>
                    </div>
                    <p
                      className="admin-element-aebbddc86"
                      data-node-id="2521:43603"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Folake Adebayo
                    </p>
                    <p
                      className="admin-element-09590fd47"
                      data-node-id="2521:43604"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Today, 09:14 AM
                    </p>
                  </div>
                  <p
                    className="admin-element-b8c7f63b4"
                    data-node-id="2521:43605"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`"3 of the 8 baskets arrived completely crushed and bruised from improper stacking in the transit van. Produce is leaking juices and unmarketable. Need immediate refund for the spoiled portion."`}</p>
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:43606"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-c51752dc8"
                      data-node-id="2521:43607"
                      data-name="paperclip"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgPaperclip} />
                    </div>
                    <p
                      className="admin-element-88241ff81"
                      data-node-id="2521:43608"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Buyer Physical Evidence (1 photo attached)
                    </p>
                    <p
                      className="admin-element-0ef330421"
                      data-node-id="2521:43609"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Full size
                    </p>
                  </div>
                  <div
                    className="admin-element-2fc0c4c9c"
                    data-node-id="2521:43610"
                    data-name="Physical evidence attachment"
                  >
                    <div
                      className="admin-element-b44bbad98"
                      data-node-id="2521:43611"
                      data-name="Reference photo"
                    >
                      <div className="admin-element-bf71252e3">
                        <img alt="" className="admin-element-d8982a2da" src={imgReferencePhoto} />
                      </div>
                    </div>
                    <div
                      className="admin-element-46fae93ef"
                      data-node-id="2521:43612"
                      data-name="Attachment metadata"
                    >
                      <p
                        className="admin-element-67366dcb7"
                        data-node-id="2521:43613"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        IMG_0821_MILE12_RECEIPT.JPG
                      </p>
                      <p
                        className="admin-element-67366dcb7"
                        data-node-id="2521:43614"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Validated timestamp: 09:08 AM · GPS: Mile 12 Market Bay 4
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-c24be905b"
                  data-node-id="2521:43615"
                  data-name="Logistics dispatch log"
                >
                  <div
                    className="admin-element-eb6012389"
                    data-node-id="2521:43616"
                    data-name="Details"
                  >
                    <p
                      className="admin-element-e32eec764"
                      data-node-id="2521:43617"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Logistics Dispatch Log #TR-992
                    </p>
                    <p
                      className="admin-element-f97e2fedf"
                      data-node-id="2521:43618"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      10:02 AM
                    </p>
                  </div>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43619"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Driver Chinedu confirmed van brake incident at Ore bypass; crate shifted during
                    heavy braking. Hub supervisor checked: 3 baskets damaged, 5 intact.
                  </p>
                </div>
              </div>
            </div>
            <div
              className="admin-element-f049e64a4"
              data-node-id="2521:43620"
              data-name="Arbitration and recommendation"
            >
              <div
                className="admin-element-c6f31dcac"
                data-node-id="2521:43621"
                data-name="Staff arbitration workspace"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43622"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:43623"
                    data-name="image"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgImage} />
                  </div>
                  <p className="admin-element-b3a6dc11c" data-node-id="2521:43624">
                    Arbitration Workspace
                  </p>
                  <p
                    className="admin-element-e5fee4b0f"
                    data-node-id="2521:43625"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ● Draft Autosaved
                  </p>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43626"
                  data-name="Divider"
                />
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43627"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Active Channel & Recipient`}</p>
                <div
                  className="admin-element-00ba2fa33"
                  data-node-id="2521:43628"
                  data-name="Recipient selection"
                >
                  <div
                    className="admin-element-6747faf61"
                    data-node-id="2521:43629"
                    data-name="Active recipient"
                  >
                    <p
                      className="admin-element-eb0917030"
                      data-node-id="2521:43630"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Reply to Buyer
                    </p>
                  </div>
                  <p
                    className="admin-element-890978262"
                    data-node-id="2521:43631"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Note to Farmer
                  </p>
                  <p
                    className="admin-element-890978262"
                    data-node-id="2521:43632"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Internal Staff Note
                  </p>
                </div>
                <div
                  className="admin-element-90e3b2382"
                  data-node-id="2521:43633"
                  data-name="Details"
                >
                  <p
                    className="admin-element-014e3d1b8"
                    data-node-id="2521:43634"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Apply Canned Macro / SOP Template
                  </p>
                  <p
                    className="admin-element-e96bc6969"
                    data-node-id="2521:43635"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Manage Templates
                  </p>
                </div>
                <div
                  className="admin-element-0069dd5f4"
                  data-node-id="2521:43636"
                  data-name="Selected SOP"
                >
                  <p
                    className="admin-element-9df9147af"
                    data-node-id="2521:43637"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Standard Template: Transit Damage Appraisal ⌄
                  </p>
                </div>
                <div
                  className="admin-element-a921291ad"
                  data-node-id="2521:43638"
                  data-name="Reply editor"
                >
                  <div
                    className="admin-element-259fec944"
                    data-node-id="2521:43639"
                    data-name="Editor toolbar"
                  >
                    <p
                      className="admin-element-16b9fb3a9"
                      data-node-id="2521:43640"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >{`B   I   ☷   │   ◇`}</p>
                    <p
                      className="admin-element-4a9b73a3b"
                      data-node-id="2521:43641"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Token: #LL-8921
                    </p>
                    <p
                      className="admin-element-16b9fb3a9"
                      data-node-id="2521:43642"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >{`▣ ₦38,000  ♧`}</p>
                  </div>
                  <div
                    className="admin-element-63c5107b2"
                    data-node-id="2521:43643"
                    data-name="Divider"
                  />
                  <div
                    className="admin-element-065d77012"
                    data-node-id="2521:43644"
                    data-name="Reply draft"
                  >
                    <p
                      className="admin-element-2ad4327fd"
                      data-node-id="2521:43645"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Hello Folake, thank you for reaching out with photos. We have reviewed the
                      transit inspection report from logistics. We are holding the payment of
                      ₦38,000 in escrow while we appraise the damaged units with our logistics hub
                      inspector.
                    </p>
                    <div
                      className="admin-element-5b26fbe69"
                      data-node-id="2521:43646"
                      data-name="Escrow protection notice"
                    >
                      <p
                        className="admin-element-923b1ee42"
                        data-node-id="2521:43647"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ⓘ Escrow Protection Active
                      </p>
                      <p
                        className="admin-element-f57c10294"
                        data-node-id="2521:43648"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Sending this message updates ticket status to “Pending Logistics Hub
                        Verification” and halts automated vendor escrow payout release for 48 hours.
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43649"
                  data-name="Details"
                >
                  <AdminControl
                    className="admin-element-8f1c37355"
                    data-node-id="2521:43650"
                    data-name="Action"
                  >
                    <div
                      className="admin-element-4713e3706"
                      data-node-id="I2521:43650;2521:20134"
                      data-name="Button:shadow"
                    />
                    <div
                      className="admin-element-9a39a55c2"
                      data-node-id="I2521:43650;2521:20135"
                      data-name="Container"
                    >
                      <div
                        className="admin-element-02fd81dbc"
                        data-node-id="I2521:43650;2521:20136"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >
                        <p className="admin-element-f62dcabf0">Mark as Pending Inspection</p>
                      </div>
                    </div>
                  </AdminControl>
                  <AdminControl
                    className="admin-element-934fe5f6f"
                    data-node-id="2521:43651"
                    data-name="Action"
                  >
                    <div
                      className="admin-element-4713e3706"
                      data-node-id="I2521:43651;2521:20134"
                      data-name="Button:shadow"
                    />
                    <div
                      className="admin-element-9a39a55c2"
                      data-node-id="I2521:43651;2521:20135"
                      data-name="Container"
                    >
                      <div
                        className="admin-element-6ab5f79d8"
                        data-node-id="I2521:43651;2521:20136"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >
                        <p className="admin-element-f62dcabf0">{`Send reply & Update status`}</p>
                      </div>
                    </div>
                  </AdminControl>
                </div>
              </div>
              <div
                className="admin-element-9e9919d6a"
                data-node-id="2521:43652"
                data-name="Resolution recommendation"
              >
                <p
                  className="admin-element-2a13fd47f"
                  data-node-id="2521:43653"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  Resolution Recommendation
                </p>
                <div
                  className="admin-element-a029c956d"
                  data-node-id="2521:43654"
                  data-name="Pro rated refund"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:43655"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-61c4d971c"
                      data-node-id="2521:43656"
                      data-name="Refund formula"
                    >
                      <p
                        className="admin-element-923b1ee42"
                        data-node-id="2521:43657"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Pro-rated 3 Baskets Return
                      </p>
                      <p
                        className="admin-element-f57c10294"
                        data-node-id="2521:43658"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Formula: (₦4,750 × 3) = ₦14,250 refund to buyer
                      </p>
                    </div>
                    <div
                      className="admin-element-0ce0ef522"
                      data-node-id="2521:43659"
                      data-name="Status badge"
                    >
                      <p
                        className="admin-element-dccb5d179"
                        data-node-id="2521:43660"
                        style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                      >
                        Policy Match: 98%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-1a2daa8d6"
              data-node-id="2521:43661"
              data-name="Order and inspection"
            >
              <div
                className="admin-element-c6f31dcac"
                data-node-id="2521:43662"
                data-name="Associated order"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43663"
                  data-name="Details"
                >
                  <div
                    className="admin-element-2374a28e4"
                    data-node-id="2521:43664"
                    data-name="Order identifier"
                  >
                    <p
                      className="admin-element-00ffde69f"
                      data-node-id="2521:43665"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Associated Order
                    </p>
                    <p
                      className="admin-element-1a2edbe43"
                      data-node-id="2521:43666"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      #LL-8921
                    </p>
                  </div>
                  <div
                    className="admin-element-852ad9382"
                    data-node-id="2521:43667"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-3bf909f93"
                      data-node-id="2521:43668"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      ♧ Held in Escrow
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43669"
                  data-name="Divider"
                />
                <p
                  className="admin-element-00e4b6b2d"
                  data-node-id="2521:43670"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ITEM BREAKDOWN
                </p>
                <div
                  className="admin-element-5414d55e2"
                  data-node-id="2521:43671"
                  data-name="Details"
                >
                  <div
                    className="admin-element-8c5395495"
                    data-node-id="2521:43672"
                    data-name="Produce line"
                  >
                    <p
                      className="admin-element-1bc30747f"
                      data-node-id="2521:43673"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      8 Baskets Roma Plum Tomatoes
                    </p>
                    <p
                      className="admin-element-68e7d3268"
                      data-node-id="2521:43674"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      ₦4,750 / raffia basket
                    </p>
                  </div>
                  <p
                    className="admin-element-d53705c5b"
                    data-node-id="2521:43675"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    ₦38,000
                  </p>
                </div>
                <div
                  className="admin-element-78ff86c3f"
                  data-node-id="2521:43676"
                  data-name="Details"
                >
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:43677"
                    data-name="Logistics fee"
                  >
                    <p
                      className="admin-element-05158b934"
                      data-node-id="2521:43678"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      Logistics Transit Fee
                    </p>
                    <p
                      className="admin-element-f57c10294"
                      data-node-id="2521:43679"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Nationwide Agri-Courier
                    </p>
                  </div>
                  <p
                    className="admin-element-14c2e7ecb"
                    data-node-id="2521:43680"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    ₦4,500
                  </p>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43681"
                  data-name="Divider"
                />
                <div
                  className="admin-element-8fe238867"
                  data-node-id="2521:43682"
                  data-name="Total escrow value"
                >
                  <p
                    className="admin-element-7d542a303"
                    data-node-id="2521:43683"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Total Escrow Value
                  </p>
                  <p className="admin-element-8c8c11589" data-node-id="2521:43684">
                    ₦42,500
                  </p>
                  <p
                    className="admin-element-66c5136e9"
                    data-node-id="2521:43685"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Protected by Leetlogic SafePay
                  </p>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43686"
                  data-name="Divider"
                />
                <p
                  className="admin-element-00e4b6b2d"
                  data-node-id="2521:43687"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`DESTINATION & DRIVER`}</p>
                <p
                  className="admin-element-31e373377"
                  data-node-id="2521:43688"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  ♧ Shop 14, Vegetable Section
                </p>
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43689"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Mile 12 International Market, Lagos
                </p>
                <p
                  className="admin-element-31e373377"
                  data-node-id="2521:43690"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  ♧ Chinedu Okeke (Driver)
                </p>
                <p
                  className="admin-element-bf3e24f3a"
                  data-node-id="2521:43691"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  +234 802 331 9901
                </p>
                <p
                  className="admin-element-afe011ff4"
                  data-node-id="2521:43692"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Van ID: LAG-884-XA
                </p>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:43693"
                  data-name="Divider"
                />
                <p
                  className="admin-element-00e4b6b2d"
                  data-node-id="2521:43694"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  SETTLEMENT ACTIONS
                </p>
                <AdminControl
                  className="admin-element-62dd21e41"
                  data-node-id="2521:43695"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:43695;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:43695;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-02fd81dbc"
                      data-node-id="I2521:43695;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Approve partial refund (₦14,250)</p>
                    </div>
                  </div>
                </AdminControl>
                <AdminControl
                  className="admin-element-c0bdbf938"
                  data-node-id="2521:43696"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:43696;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:43696;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-02fd81dbc"
                      data-node-id="I2521:43696;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Release remaining to farmer</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
              <div
                className="admin-element-1b23ff285"
                data-node-id="2521:43697"
                data-name="Inspection checklist"
              >
                <p
                  className="admin-element-ea475dd09"
                  data-node-id="2521:43698"
                  style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                >
                  Inspection Checklist ☷
                </p>
                <p
                  className="admin-element-1fdfed600"
                  data-node-id="2521:43699"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ✓ Photo timestamp matches gate log
                </p>
                <p
                  className="admin-element-1fdfed600"
                  data-node-id="2521:43700"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ✓ Weight loss within allowable tolerance
                </p>
                <p
                  className="admin-element-1597312f3"
                  data-node-id="2521:43701"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ⓘ Stacking protocol violated in van
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
