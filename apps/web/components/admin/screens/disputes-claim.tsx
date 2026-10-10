import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgTomatoBasketPhoto = `${assetPathPrefix}/955b4.png`;
const imgPickupPhoto = `${assetPathPrefix}/a6d46.png`;
const imgBotanicalMark = `${assetPathPrefix}/67377.svg`;
const imgWordmark = `${assetPathPrefix}/0ad4c.svg`;
const imgShieldCheck = `${assetPathPrefix}/3d049.svg`;
const imgLayoutGrid = `${assetPathPrefix}/d3ab6.svg`;
const imgDelivery = `${assetPathPrefix}/0bac5.svg`;
const imgLayoutGrid1 = `${assetPathPrefix}/5d284.svg`;
const imgBell = `${assetPathPrefix}/ec39a.svg`;
const imgDelivery1 = `${assetPathPrefix}/9580b.svg`;
const imgShieldCheck1 = `${assetPathPrefix}/94b6f.svg`;
const imgShieldCheck2 = `${assetPathPrefix}/70550.svg`;
const imgShieldCheck3 = `${assetPathPrefix}/d6b4c.svg`;
const imgMessageSquare = `${assetPathPrefix}/64385.svg`;
const imgLoader = `${assetPathPrefix}/7c497.svg`;
export default function Component2105DisputeClaimDetail() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:44080"
      data-name="21.05 · Dispute claim detail"
    >
      <div className="admin-element-52c1e5d35" data-node-id="2521:44081" data-name="Staff sidebar">
        <div
          className="admin-element-4fc05b874"
          data-node-id="2521:44082"
          data-name="Approved LeetLogic logo"
        >
          <div
            className="admin-element-f84de7678"
            data-node-id="2521:44083"
            data-name="Botanical mark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
          </div>
          <div className="admin-element-0cf7a046e" data-node-id="2521:44086" data-name="Wordmark">
            <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
          </div>
        </div>
        <p
          className="admin-element-31e02e224"
          data-node-id="2521:44096"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Admin Portal
        </p>
        <div className="admin-element-0f896c36f" data-node-id="2521:44097" data-name="Notice">
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:44098"
            data-name="shield-check"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck} />
          </div>
          <div className="admin-element-b8d938929" data-node-id="2521:44100" data-name="Guidance">
            <p
              className="admin-element-fc65763f1"
              data-node-id="2521:44101"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Amaka
            </p>
            <Link
              className="admin-element-5a7d6aeb8"
              data-node-id="2521:44102"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/support"
            >
              Operations / Support Officer
            </Link>
          </div>
        </div>
        <div
          className="admin-element-c94ed62b9"
          data-node-id="2521:44103"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:44104"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44105"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:44107"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:44108"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44109"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:44111"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:44112"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44113"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:44115"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:44116"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:44117" data-name="Delivery">
              <img alt="" className="admin-element-8faf267d3" src={imgDelivery} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:44118"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Orders & Logistics`}</span>
          </Link>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:44119"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44120"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:44122"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/users"
            >
              Users
            </Link>
          </div>
          <Link
            className="admin-element-e6503ba75"
            data-node-id="2521:44123"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44124"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid1} />
            </div>
            <span
              className="admin-element-ab50075fc"
              data-node-id="2521:44126"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Tickets`}</span>
          </Link>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:44127"
            data-name="Navigation item"
            href="/admin/support/chat"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44128"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:44130"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Live Chat Console
            </span>
          </Link>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:44131"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44132"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:44134"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/risk"
            >{`Fraud & Risk`}</Link>
          </div>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:44135"
            data-name="Navigation item"
            href="/admin/translations"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44136"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:44138"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Localization & Translations`}</span>
          </Link>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:44139"
            data-name="Navigation item"
            href="/admin/settings"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:44140"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:44142"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Staff Settings
            </span>
          </Link>
        </div>
        <p
          className="admin-element-66df30e07"
          data-node-id="2521:44143"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          ● Ops Portal v2.4
        </p>
      </div>
      <div className="admin-element-7c219a7f7" data-node-id="2521:44144" data-name="Workspace">
        <div
          className="admin-element-ecfad9b8a"
          data-node-id="2521:44145"
          data-name="Staff toolbar"
        >
          <div className="admin-element-311e6f066" data-node-id="2521:44146" data-name="Status">
            <p
              className="admin-element-c5601f4a4"
              data-node-id="2521:44147"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● Systems Normal · 99.98%
            </p>
          </div>
          <p
            className="admin-element-6408cdf1a"
            data-node-id="2521:44148"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            ⌕ Search ID, merchant, ticket, or batch...
          </p>
          <div className="admin-element-eaa60f1c4" data-node-id="2521:44149" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <p
            className="admin-element-7047931a8"
            data-node-id="2521:44151"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka O. · Shift Lead
          </p>
        </div>
        <div
          className="admin-element-aa4763de2"
          data-node-id="2521:44152"
          data-name="Workspace content"
        >
          <p
            className="admin-element-5d48322fc"
            data-node-id="2521:44153"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Dispute Queue / Ticket #2041 / Tunde Bakare vs Chibuzor Simon
          </p>
          <div className="admin-element-e821f4f4f" data-node-id="2521:44154" data-name="Card">
            <div
              className="admin-element-47aacf6d1"
              data-node-id="2521:44155"
              data-name="Header row"
            >
              <div
                className="admin-element-39a65e5fe"
                data-node-id="2521:44156"
                data-name="Title block"
              >
                <p className="admin-element-e998956ce" data-node-id="2521:44157">
                  Ticket #2041: Damaged Produce Claim
                </p>
                <div
                  className="admin-element-809b2842b"
                  data-node-id="2521:44158"
                  data-name="Meta row"
                >
                  <p
                    className="admin-element-9157e53e3"
                    data-node-id="2521:44159"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Linked to Order #ORD-7824 · Fresh Roma Tomatoes (4 × 50kg Raffia Baskets)
                  </p>
                  <p
                    className="admin-element-e6fc17f9f"
                    data-node-id="2521:44160"
                    style={{ fontVariationSettings: '"CTGR" 100, "wdth" 100' }}
                  >
                    Escrow Value: ₦35,600 Held
                  </p>
                </div>
              </div>
              <div className="admin-element-9886988e7" data-node-id="2521:44161" data-name="Status">
                <p
                  className="admin-element-1b81774f5"
                  data-node-id="2521:44162"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Open · Assigned to Amaka Okonkwo
                </p>
              </div>
            </div>
            <div
              className="admin-element-47aacf6d1"
              data-node-id="2521:44163"
              data-name="Action buttons"
            >
              <AdminControl
                className="admin-element-1b42e2902"
                data-node-id="2521:44164"
                data-name="Action"
              >
                <div
                  className="admin-element-4713e3706"
                  data-node-id="I2521:44164;2521:20134"
                  data-name="Button:shadow"
                />
                <div
                  className="admin-element-9a39a55c2"
                  data-node-id="I2521:44164;2521:20135"
                  data-name="Container"
                >
                  <div
                    className="admin-element-f6c256db7"
                    data-node-id="I2521:44164;2521:20136"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <Link className="admin-element-f62dcabf0" href="/admin/audit">
                      Audit Log
                    </Link>
                  </div>
                </div>
              </AdminControl>
              <AdminControl
                className="admin-element-1b42e2902"
                data-node-id="2521:44165"
                data-name="Action"
              >
                <div
                  className="admin-element-4713e3706"
                  data-node-id="I2521:44165;2521:20134"
                  data-name="Button:shadow"
                />
                <div
                  className="admin-element-9a39a55c2"
                  data-node-id="I2521:44165;2521:20135"
                  data-name="Container"
                >
                  <div
                    className="admin-element-f6c256db7"
                    data-node-id="I2521:44165;2521:20136"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <p className="admin-element-f62dcabf0">Call Parties</p>
                  </div>
                </div>
              </AdminControl>
            </div>
          </div>
          <div
            className="admin-element-b13473824"
            data-node-id="2521:44166"
            data-name="Claim and adjudication"
          >
            <div
              className="admin-element-ecd691fec"
              data-node-id="2521:44167"
              data-name="Party evidence"
            >
              <div className="admin-element-2ec9c9d15" data-node-id="2521:44168" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44169"
                  data-name="Buyer header"
                >
                  <div
                    className="admin-element-13f4a88b3"
                    data-node-id="2521:44170"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-3e13ac1a9"
                      data-node-id="2521:44171"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      TB
                    </p>
                  </div>
                  <div
                    className="admin-element-703eac8e0"
                    data-node-id="2521:44172"
                    data-name="Buyer info"
                  >
                    <p
                      className="admin-element-3847ff0e0"
                      data-node-id="2521:44173"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Tunde Bakare · Buyer (Retail Wholesaler)
                    </p>
                    <p
                      className="admin-element-f815fe903"
                      data-node-id="2521:44174"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Depot Reception: Victoria Island, Lagos
                    </p>
                  </div>
                  <div
                    className="admin-element-65b4672ff"
                    data-node-id="2521:44175"
                    data-name="Damage badge"
                  >
                    <p
                      className="admin-element-8a6476946"
                      data-node-id="2521:44176"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      50% Cargo Damage Reported
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-8cba03f6c"
                  data-node-id="2521:44177"
                  data-name="Statement"
                >
                  <p
                    className="admin-element-c4ea86dcc"
                    data-node-id="2521:44178"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`"Upon unloading from the dispatch vehicle at Victoria Island depot, 2 out of the 4 raffia baskets of Roma tomatoes were severely crushed and squashed with juice leaking through the baskets. The driver noted this on the physical delivery manifest."`}</p>
                </div>
                <p
                  className="admin-element-e5f1ace55"
                  data-node-id="2521:44179"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Photographic Evidence Submitted by Buyer
                </p>
                <div
                  className="admin-element-452d34671"
                  data-node-id="2521:44180"
                  data-name="Evidence grid"
                >
                  <div
                    className="admin-element-2c53a1857"
                    data-node-id="2521:44181"
                    data-name="Main photo container"
                  >
                    <div
                      className="admin-element-53e5d70f9"
                      data-node-id="2521:44182"
                      data-name="Photo frame"
                    >
                      <div
                        className="admin-element-498a00bf0"
                        data-node-id="2521:44183"
                        data-name="Tomato basket photo"
                      >
                        <img
                          alt=""
                          className="admin-element-6c9f0a61a"
                          src={imgTomatoBasketPhoto}
                        />
                      </div>
                      <div
                        className="admin-element-9472f302f"
                        data-node-id="2521:44184"
                        data-name="Photo metadata"
                      >
                        <p
                          className="admin-element-268e0a44d"
                          data-node-id="2521:44185"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Photo 1 of 2: Unloading at Victoria Island · Timestamp: 24 Oct, 11:35 AM ·
                          GPS: 6.4281° N, 3.4219° E · EXIF Verified
                        </p>
                      </div>
                    </div>
                    <p
                      className="admin-element-647996307"
                      data-node-id="2521:44186"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Photo 1 of 2: Uploaded by buyer Tunde Bakare upon delivery · EXIF verified
                    </p>
                  </div>
                  <div
                    className="admin-element-39554385a"
                    data-node-id="2521:44187"
                    data-name="Supporting docs"
                  >
                    <div
                      className="admin-element-889b9ec90"
                      data-node-id="2521:44188"
                      data-name="Waybill document"
                    >
                      <div
                        className="admin-element-7c707f74d"
                        data-node-id="2521:44189"
                        data-name="Doc header"
                      >
                        <p
                          className="admin-element-8da1448d2"
                          data-node-id="2521:44190"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          LEET LOGIC AGRI-COURIER
                        </p>
                      </div>
                      <div
                        className="admin-element-0479640d0"
                        data-node-id="2521:44191"
                        data-name="Doc body"
                      >
                        <div
                          className="admin-element-2d862b5ca"
                          data-node-id="2521:44192"
                          data-name="Doc row"
                        >
                          <p
                            className="admin-element-9157e53e3"
                            data-node-id="2521:44193"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Waybill Ref:
                          </p>
                          <p
                            className="admin-element-1fc3bc9b9"
                            data-node-id="2521:44194"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            TRK-9812
                          </p>
                        </div>
                        <div
                          className="admin-element-2d862b5ca"
                          data-node-id="2521:44195"
                          data-name="Doc row"
                        >
                          <p
                            className="admin-element-9157e53e3"
                            data-node-id="2521:44196"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Order:
                          </p>
                          <p
                            className="admin-element-1fc3bc9b9"
                            data-node-id="2521:44197"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            ORD-7824
                          </p>
                        </div>
                        <div
                          className="admin-element-2d862b5ca"
                          data-node-id="2521:44198"
                          data-name="Doc row"
                        >
                          <p
                            className="admin-element-9157e53e3"
                            data-node-id="2521:44199"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Driver:
                          </p>
                          <p
                            className="admin-element-1fc3bc9b9"
                            data-node-id="2521:44200"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Chinedu Obi
                          </p>
                        </div>
                        <div
                          className="admin-element-df264a64f"
                          data-node-id="2521:44201"
                          data-name="Doc row"
                        >
                          <p
                            className="admin-element-a8b29e92a"
                            data-node-id="2521:44202"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Status:
                          </p>
                          <div
                            className="admin-element-946ba2d7a"
                            data-node-id="2521:44203"
                            data-name="Damage stamp"
                          >
                            <p
                              className="admin-element-9cc3fcd11"
                              data-node-id="2521:44204"
                              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                            >
                              DAMAGE NOTED
                            </p>
                          </div>
                        </div>
                        <div
                          className="admin-element-6a233c377"
                          data-node-id="2521:44205"
                          data-name="Sig line"
                        >
                          <p
                            className="admin-element-a8b29e92a"
                            data-node-id="2521:44206"
                            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                          >
                            Sig:
                          </p>
                          <div
                            className="admin-element-601c95847"
                            data-node-id="2521:44207"
                            data-name="Sig box"
                          >
                            <p
                              className="admin-element-b38e91870"
                              data-node-id="2521:44208"
                              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                            >
                              C. Obi ✓
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p
                      className="admin-element-3272045be"
                      data-node-id="2521:44209"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Signed Waybill · TRK-9812
                    </p>
                    <div
                      className="admin-element-da5f457f4"
                      data-node-id="2521:44210"
                      data-name="Checklist photo frame"
                    >
                      <div
                        className="admin-element-b0ece1835"
                        data-node-id="2521:44211"
                        data-name="Pickup photo"
                      >
                        <img alt="" className="admin-element-8e3c2e60f" src={imgPickupPhoto} />
                      </div>
                    </div>
                    <p
                      className="admin-element-3272045be"
                      data-node-id="2521:44212"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Pickup Checklist Photo
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-c702cc51c"
                  data-node-id="2521:44213"
                  data-name="Notice"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:44214"
                    data-name="Delivery"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgDelivery1} />
                  </div>
                  <div
                    className="admin-element-84366c497"
                    data-node-id="2521:44215"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-9e4533325"
                      data-node-id="2521:44216"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Courier Waybill Endorsement #TRK-9812
                    </p>
                    <p
                      className="admin-element-7d262bb8b"
                      data-node-id="2521:44217"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >{`Courier Driver Chinedu Obi confirmed: '2 baskets damaged due to road bumps on Ore route. Load shifting occurred between Ore and Sagamu expressway.'`}</p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-37cf9a977"
                data-node-id="2521:44242"
                data-name="Leetlogic iOS / Profile field"
              >
                <div
                  className="admin-element-933def9fa"
                  data-node-id="I2521:44242;2521:21278"
                  data-name="Farmer testimony content"
                >
                  <div
                    className="admin-element-5cc24a280"
                    data-node-id="I2521:44242;2521:21278;2521:44219"
                    data-name="Seller statement"
                  >
                    <div
                      className="admin-element-47aacf6d1"
                      data-node-id="I2521:44242;2521:21278;2521:44220"
                      data-name="Details"
                    >
                      <div
                        className="admin-element-13f4a88b3"
                        data-node-id="I2521:44242;2521:21278;2521:44221"
                        data-name="Avatar"
                      >
                        <p
                          className="admin-element-3e13ac1a9"
                          data-node-id="I2521:44242;2521:21278;2521:44222"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          CS
                        </p>
                      </div>
                      <div
                        className="admin-element-d1d2d7dc6"
                        data-node-id="I2521:44242;2521:21278;2521:44223"
                        data-name="Farmer info"
                      >
                        <p
                          className="admin-element-4b97c94ea"
                          data-node-id="I2521:44242;2521:21278;2521:44224"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Chibuzor Simon
                        </p>
                        <p
                          className="admin-element-87dac1e95"
                          data-node-id="I2521:44242;2521:21278;2521:44225"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Dispatch Point: Abakaliki Collection Center
                        </p>
                      </div>
                      <div
                        className="admin-element-70a624467"
                        data-node-id="I2521:44242;2521:21278;2521:44226"
                        data-name="Status"
                      >
                        <p
                          className="admin-element-d2a86cbab"
                          data-node-id="I2521:44242;2521:21278;2521:44227"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Verified Farmer
                        </p>
                      </div>
                    </div>
                    <div
                      className="admin-element-9d9676318"
                      data-node-id="I2521:44242;2521:21278;2521:44228"
                      data-name="Statement"
                    >
                      <p
                        className="admin-element-c4ea86dcc"
                        data-node-id="I2521:44242;2521:21278;2521:44229"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >{`"Produce was packed in fresh reinforced baskets in Abakaliki. Transit shock was courier handling. The goods were inspected and handed to LeetLogic 3PL partner in pristine condition."`}</p>
                    </div>
                    <div
                      className="admin-element-c702cc51c"
                      data-node-id="I2521:44242;2521:21278;2521:44230"
                      data-name="Origin notice"
                    >
                      <div
                        className="admin-element-35368e319"
                        data-node-id="I2521:44242;2521:21278;2521:44231"
                        data-name="shield-check"
                      >
                        <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck1} />
                      </div>
                      <div
                        className="admin-element-84366c497"
                        data-node-id="I2521:44242;2521:21278;2521:44233"
                        data-name="Guidance"
                      >
                        <p
                          className="admin-element-9e4533325"
                          data-node-id="I2521:44242;2521:21278;2521:44234"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Origin Hub Inspection
                        </p>
                        <p
                          className="admin-element-7d262bb8b"
                          data-node-id="I2521:44242;2521:21278;2521:44235"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Passed Grade A (10:15 AM) · View Origin Inspection Report
                        </p>
                      </div>
                    </div>
                    <div
                      className="admin-element-c702cc51c"
                      data-node-id="I2521:44242;2521:21278;2521:44236"
                      data-name="Logistics notice"
                    >
                      <div
                        className="admin-element-35368e319"
                        data-node-id="I2521:44242;2521:21278;2521:44237"
                        data-name="shield-check"
                      >
                        <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck1} />
                      </div>
                      <div
                        className="admin-element-84366c497"
                        data-node-id="I2521:44242;2521:21278;2521:44239"
                        data-name="Guidance"
                      >
                        <p
                          className="admin-element-9e4533325"
                          data-node-id="I2521:44242;2521:21278;2521:44240"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Logistics Protection
                        </p>
                        <p
                          className="admin-element-7d262bb8b"
                          data-node-id="I2521:44242;2521:21278;2521:44241"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Transit Guarantee Active · SwiftAgro Haulage Ltd
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-d085e6baa"
              data-node-id="2521:44243"
              data-name="Decision desk"
            >
              <div className="admin-element-2ec9c9d15" data-node-id="2521:44244" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44245"
                  data-name="Details"
                >
                  <p className="admin-element-884d51a02" data-node-id="2521:44246">
                    Escrow Custody Summary
                  </p>
                  <div
                    className="admin-element-70a624467"
                    data-node-id="2521:44247"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-d2a86cbab"
                      data-node-id="2521:44248"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Vault Locked
                    </p>
                  </div>
                </div>
                <div className="admin-element-b98b2258c" data-node-id="2521:44249" data-name="Line">
                  <p
                    className="admin-element-507b2eb24"
                    data-node-id="2521:44250"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Produce Escrow (4 baskets)
                  </p>
                  <p
                    className="admin-element-16d7e7daa"
                    data-node-id="2521:44251"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦32,000
                  </p>
                </div>
                <div className="admin-element-7291e39de" data-node-id="2521:44252" data-name="Line">
                  <div
                    className="admin-element-8c1e8a6a9"
                    data-node-id="2521:44253"
                    data-name="Label col"
                  >
                    <p
                      className="admin-element-d0f86a309"
                      data-node-id="2521:44254"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Logistics Fare
                    </p>
                    <p
                      className="admin-element-85521da8e"
                      data-node-id="2521:44255"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Abakaliki → Lagos
                    </p>
                  </div>
                  <p
                    className="admin-element-e68f32eff"
                    data-node-id="2521:44256"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦3,000
                  </p>
                </div>
                <div className="admin-element-b98b2258c" data-node-id="2521:44257" data-name="Line">
                  <p
                    className="admin-element-507b2eb24"
                    data-node-id="2521:44258"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Platform Escrow Fee
                  </p>
                  <p
                    className="admin-element-16d7e7daa"
                    data-node-id="2521:44259"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦600
                  </p>
                </div>
                <div
                  className="admin-element-63c5107b2"
                  data-node-id="2521:44260"
                  data-name="Divider"
                />
                <div
                  className="admin-element-1695ef614"
                  data-node-id="2521:44261"
                  data-name="Total"
                >
                  <p
                    className="admin-element-e68ff1aa4"
                    data-node-id="2521:44262"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Total In Escrow
                  </p>
                  <p className="admin-element-e87e840b3" data-node-id="2521:44263">
                    ₦35,600
                  </p>
                </div>
                <div
                  className="admin-element-c702cc51c"
                  data-node-id="2521:44264"
                  data-name="Notice"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44265"
                    data-name="shield-check"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck2} />
                  </div>
                  <div
                    className="admin-element-2d9758af7"
                    data-node-id="2521:44267"
                    data-name="Guidance"
                  >
                    <div
                      className="admin-element-df264a64f"
                      data-node-id="2521:44268"
                      data-name="Claim header"
                    >
                      <p
                        className="admin-element-110f73712"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        VERIFIED CLAIM AMOUNT
                      </p>
                      <div
                        className="admin-element-1911377c6"
                        data-node-id="2521:44270"
                        data-name="Loss ratio"
                      >
                        <p
                          className="admin-element-cc8c07662"
                          data-node-id="2521:44271"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          50% Loss Ratio
                        </p>
                      </div>
                    </div>
                    <p
                      className="admin-element-da00d5b5c"
                      data-node-id="2521:44272"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      2 of 4 baskets crushed = ₦16,000 produce loss claimed by Buyer.
                    </p>
                  </div>
                </div>
              </div>
              <div className="admin-element-2ec9c9d15" data-node-id="2521:44273" data-name="Card">
                <div
                  className="admin-element-7291e39de"
                  data-node-id="2521:44274"
                  data-name="Adj header"
                >
                  <p className="admin-element-21b2e9dec">Adjudication Actions</p>
                  <p
                    className="admin-element-8c3180e7b"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Amaka Okonkwo (Ops Lead)
                  </p>
                </div>
                <AdminControl
                  className="admin-element-2b1633058"
                  data-node-id="2521:44277"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:44277;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:44277;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-7613f5d5f"
                      data-node-id="I2521:44277;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Refund Buyer (₦16,000 Claim)</p>
                    </div>
                  </div>
                </AdminControl>
                <p
                  className="admin-element-5b21091b5"
                  data-node-id="2521:44278"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Reimburse buyer wallet for destroyed baskets
                </p>
                <AdminControl
                  className="admin-element-039b2f996"
                  data-node-id="2521:44279"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:44279;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:44279;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-f6c256db7"
                      data-node-id="I2521:44279;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Release Full to Farmer (₦32,000)</p>
                    </div>
                  </div>
                </AdminControl>
                <p
                  className="admin-element-5b21091b5"
                  data-node-id="2521:44280"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Dismiss claim; cargo accepted at pickup
                </p>
                <div
                  className="admin-element-c81a43f17"
                  data-node-id="2521:44281"
                  data-name="Split notice"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44282"
                    data-name="shield-check"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck3} />
                  </div>
                  <div
                    className="admin-element-84366c497"
                    data-node-id="2521:44284"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-9e4533325"
                      data-node-id="2521:44285"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Split 50/50 Settlement
                    </p>
                    <p
                      className="admin-element-7d262bb8b"
                      data-node-id="2521:44286"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      ₦16,000 to Buyer · ₦16,000 to Farmer · 3PL penalty
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-f0adebf56"
                  data-node-id="2521:44287"
                  data-name="Justification header"
                >
                  <p className="admin-element-66112446f">Mandatory Resolution Justification</p>
                  <p
                    className="admin-element-016026be0"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    * Required for Audit
                  </p>
                </div>
                <div
                  className="admin-element-41ef69ab2"
                  data-node-id="2521:44290"
                  data-name="Justification text"
                >
                  <p
                    className="admin-element-c4ea86dcc"
                    data-node-id="2521:44291"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    50% partial refund granted based on photo evidence and driver endorsement. Road
                    transit shock shifted produce crates; ₦16,000 loss verified.
                  </p>
                </div>
                <div
                  className="admin-element-c702cc51c"
                  data-node-id="2521:44292"
                  data-name="SMS notice"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44293"
                    data-name="message-square"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgMessageSquare} />
                  </div>
                  <div
                    className="admin-element-84366c497"
                    data-node-id="2521:44295"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-9e4533325"
                      data-node-id="2521:44296"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Automated SMS Dispatch upon Execution
                    </p>
                    <p
                      className="admin-element-7d262bb8b"
                      data-node-id="2521:44297"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Buyer SMS: +234 812 400 8921 · Farmer SMS: +234 803 555 0142
                    </p>
                  </div>
                </div>
                <AdminControl
                  className="admin-element-2b1633058"
                  data-node-id="2521:44298"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:44298;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:44298;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-7613f5d5f"
                      data-node-id="I2521:44298;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">{`Execute Resolution & Release Funds`}</p>
                    </div>
                  </div>
                </AdminControl>
                <AdminControl
                  className="admin-element-039b2f996"
                  data-node-id="2521:44299"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:44299;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:44299;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-f6c256db7"
                      data-node-id="I2521:44299;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Save Draft</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
              <div
                className="admin-element-cbc369e37"
                data-node-id="2521:44300"
                data-name="App / Resilience State"
              >
                <div
                  className="admin-element-bf5b17a54"
                  data-node-id="I2521:44300;1:27891"
                  data-name="State icon"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="I2521:44300;1:27892"
                    data-name="loader"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgLoader} />
                  </div>
                </div>
                <p className="admin-element-980af1c9d" data-node-id="I2521:44300;1:27893">
                  SLA Timer Active
                </p>
                <p
                  className="admin-element-e80b5671e"
                  data-node-id="I2521:44300;1:27894"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Escrow auto-hold expires in 47h 22m. Resolution must be filed before expiry to
                  prevent forced equal-split default.
                </p>
                <div
                  className="admin-element-8766898ad"
                  data-node-id="I2521:44300;1:27895"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-2b3eeaa51"
                    data-node-id="I2521:44300;1:27896"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Open · 47h 22m
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
