import React from "react";
import { Modal, Typography, Button, Table } from "@douyinfe/semi-ui";
import sdk from "../../../utils/sdk";
import "./index.less";

interface IProps {
  spaceId: string;
  logs: any[];
  workObjectId?: string;
  successCount?: number;
}

const LogsModal = (props: IProps) => {
  const { Text } = Typography;
  const { logs, spaceId, workObjectId = '', successCount = 0 } = props;
  const columns = [
    {
      title: "实例名称",
      dataIndex: "work_item_name",
      width: 180,
      render: (text, record, index) => {
        return (
          <Text
            style={{
              fontWeight: 500,
            }}
            link
            onClick={async () => {
              const space = await sdk.Space.load(spaceId || "");
              sdk.navigation.open(
                `/${space.simpleName}/${workObjectId}/detail/${record?.work_item_id}`,
                "_blank"
              );
            }}
          >
            {record.params.work_item_name}
          </Text>
        );
      },
    },
    {
      title: "ID",
      width: 120,
      dataIndex: "work_item_id",
    },
    {
      title: "失败原因",
      dataIndex: "err_msg",
    },
  ];
  const scroll = React.useMemo(() => ({ y: 350 }), []);
  return (
    <>
      <Modal
        motion={false}
        // title={'错误日志'}
        // fullScreenWithoutMargin
        fullScreen
        closable={false}
        visible={true}
        header={
          <div>
            <div style={{ display: "flex", marginTop: 4 }}>
              <Text>
                操作结果：成功 {successCount} 个，失败 {logs.length} 个
              </Text>
            </div>
          </div>
        }
        footer={[
          <Button
            key="confirm"
            type="primary"
            onClick={() => {
              sdk.containerModal.submit?.({});
              sdk.containerModal.close();
            }}
            style={{ backgroundColor: "#005BAC", color: "#fff" }}
          >
            确定
          </Button>,
        ]}
      >
        {logs.length ? (
          <Table
            className="error-table"
            columns={columns}
            dataSource={logs}
            pagination={false}
            scroll={scroll}
          />
        ) : null}
      </Modal>
    </>
  );
};
export default LogsModal;
