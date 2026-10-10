import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgBotanicalMark = `${assetPathPrefix}/62c76.svg`;
const imgWordmark = `${assetPathPrefix}/ffb6d.svg`;
export default function Component1905StaffSecurityCode() {
  return (
    <div
      className="admin-element-46d8420fd"
      data-node-id="2521:42646"
      data-name="19.05 · Staff security code"
    >
      <div className="admin-element-2c764c3bd" data-node-id="2521:42647" data-name="Card">
        <div
          className="admin-element-502ca864a"
          data-node-id="2521:42648"
          data-name="Security verification"
        >
          <div
            className="admin-element-4fc05b874"
            data-node-id="2521:42649"
            data-name="Approved LeetLogic logo"
          >
            <div
              className="admin-element-f84de7678"
              data-node-id="2521:42650"
              data-name="Botanical mark"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
            </div>
            <div className="admin-element-0cf7a046e" data-node-id="2521:42653" data-name="Wordmark">
              <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
            </div>
          </div>
          <div className="admin-element-311e6f066" data-node-id="2521:42663" data-name="Status">
            <p
              className="admin-element-c5601f4a4"
              data-node-id="2521:42664"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Two-Step Verification
            </p>
          </div>
          <p className="admin-element-7f52c2a7a" data-node-id="2521:42665">
            Enter security code
          </p>
          <p
            className="admin-element-e28ed4ab3"
            data-node-id="2521:42666"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Sent to Amaka’s phone (+234 ••• ••• •042)
          </p>
          <div className="admin-element-4a6cc29e3" data-node-id="2521:42667" data-name="Code entry">
            <AdminField
              className="admin-element-d774422c6"
              data-node-id="2521:42668"
              data-name="Code digit"
              initialValue="5"
              label="Security code digit"
            />
            <AdminField
              className="admin-element-d774422c6"
              data-node-id="2521:42670"
              data-name="Code digit"
              initialValue="8"
              label="Security code digit"
            />
            <AdminField
              className="admin-element-d774422c6"
              data-node-id="2521:42672"
              data-name="Code digit"
              initialValue="2"
              label="Security code digit"
            />
            <AdminField
              className="admin-element-d774422c6"
              data-node-id="2521:42674"
              data-name="Code digit"
              initialValue="9"
              label="Security code digit"
            />
            <AdminField
              className="admin-element-09e33ad68"
              data-node-id="2521:42676"
              data-name="Code digit"
              initialValue="_"
              label="Security code digit"
            />
            <AdminField
              className="admin-element-d774422c6"
              data-node-id="2521:42678"
              data-name="Code digit"
              initialValue="_"
              label="Security code digit"
            />
          </div>
          <p
            className="admin-element-0451a70dd"
            data-node-id="2521:42680"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >{`Didn't receive the SMS? Resend code in 0:40`}</p>
          <AdminControl
            className="admin-element-2b1633058"
            data-node-id="2521:42681"
            data-name="Action"
          >
            <div
              className="admin-element-4713e3706"
              data-node-id="I2521:42681;2521:20134"
              data-name="Button:shadow"
            />
            <div
              className="admin-element-9a39a55c2"
              data-node-id="I2521:42681;2521:20135"
              data-name="Container"
            >
              <div
                className="admin-element-7613f5d5f"
                data-node-id="I2521:42681;2521:20136"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                <p className="admin-element-f62dcabf0">{`Verify & Continue →`}</p>
              </div>
            </div>
          </AdminControl>
          <AdminControl
            className="admin-element-039b2f996"
            data-node-id="2521:42682"
            data-name="Action"
          >
            <div
              className="admin-element-4713e3706"
              data-node-id="I2521:42682;2521:20134"
              data-name="Button:shadow"
            />
            <div
              className="admin-element-9a39a55c2"
              data-node-id="I2521:42682;2521:20135"
              data-name="Container"
            >
              <div
                className="admin-element-f6c256db7"
                data-node-id="I2521:42682;2521:20136"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                <p className="admin-element-f62dcabf0">Use security hardware key instead</p>
              </div>
            </div>
          </AdminControl>
          <p
            className="admin-element-e28ed4ab3"
            data-node-id="2521:42683"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            ← Return to login
          </p>
        </div>
      </div>
      <p
        className="admin-element-22be5d238"
        data-node-id="2521:42684"
        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
      >
        256-bit TLS Encrypted · LeetLogic Staff Auth v4.12
      </p>
    </div>
  );
}
