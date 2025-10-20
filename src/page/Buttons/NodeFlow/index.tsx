import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Collapse,
  Row,
  Col,
  Typography,
  Form,
  Spin,
  Select,
  Banner,
  Button,
} from "@douyinfe/semi-ui";
import {
  IconSmallTriangleDown,
  IconSmallTriangleRight,
} from "@douyinfe/semi-icons";
import {
  getWorkItemFieldDetail,
  fetchFlowNodes,
  fetchWorkObjectFields,
  fetchFormField,
  type FlowNode,
  type WorkflowConfig,
} from "../../../api";
import ItemCol from "./ItemCol";
import sdk from "../../../utils/sdk";
import {
  batchConcurrentRequestController,
  type RequestResult,
  customExecutor,
  groupByFieldKey,
} from "./utils";
import "./index.less";
import LogsModal from "../Error";

/**
 * 分批处理数组元素并发送请求
 * @param {Array} items - 需要处理的数组
 * @param {number} batchSize - 每批处理的元素数量
 * @param {Function} requestHandler - 处理每批元素的请求函数，应返回Promise
 * @returns {Promise} - 当所有批次请求完成后resolve的Promise，包含所有结果
 */
const batchRequestSender = async (items, batchSize, requestHandler, params) => {
  const results: any[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, items.length);
    const batchItems = items.slice(startIndex, endIndex);
    const batchResult = await requestHandler(batchItems, batchIndex, params);
    results.push(...batchResult);
  }
  return results;
};

// 实例是否聚合的字段控制
const IsAggregated = true;

const NodeFlow = (props) => {
  const { Text } = Typography;
  const selectedWorkItemIds = props.selectedWorkItems?.[0].selectedWorkItemIds;
  const spaceId = props.selectedWorkItems?.[0].spaceId;
  const workObjectId = props.selectedWorkItems?.[0].workObjectId;

  const [selectedWIIds, setSelectedWIIds] = useState(selectedWorkItemIds);
  const [formApi, setFormApi] = useState<any>();

  const [loading, setLoading] = useState(false);
  const [workItemsDetail, setWorkItemsDetail] = useState<any[]>([]);

  const [fieldLists, setFieldLists] = useState<Record<string, any>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(0);
  const nodeListByTemplateId = useRef<Record<string, any[]>>();
  const [nodeLists, setNodeLists] = useState<WorkflowConfig[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(
    undefined
  );
  const [nodeBatch, setNodeBatch] = useState<number>(0);

  const [failed, setFailed] = useState<RequestResult[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [tempIds, setTempIds] = useState<number[]>([]);
  const [successCount, setSuccessCount] = useState(0);

  const [checkNode, setCheckNode] = useState<boolean>(true);
  const [workItemName, setWorkItemName] = useState<string>("");

  useEffect(() => {
    if (!spaceId) {
      return;
    }
    setLoading(true);
    try {
      batchRequestSender(
        selectedWorkItemIds,
        50,
        async (batchItems, batchIndex, param) => {
          const result = await getWorkItemFieldDetail({
            work_item_ids: batchItems,
            ...param,
          });
          return result;
        },
        {
          project_key: spaceId,
          work_item_type_key: workObjectId,
          // work_item_ids: selectedWorkItemIds,
          expand: {
            need_workflow: true, // 是否返回工作流信息
            need_multi_text: false, // 是否返回富文本
            need_user_detail: false, // 是否返回用户详情
            need_sub_task_parent: false, // 是否返回子任务相关信息
            relation_fields_detail: false, // 是否返回关联字段详情
          },
        }
      )
        .then(async (res) => {
          const _checkNode = res.some(
            (i) => i.workflow_infos?.workflow_nodes?.length > 0
          );
          setCheckNode(!res.some((i) => i.workflow_infos === null));
          if (_checkNode) {
            setWorkItemsDetail(res);
            const _tempIds = [...new Set(res.map((i) => i.template_id))];
            setTempIds(_tempIds);
            if (_tempIds.length === 1) {
              const nodeFlowLists = (await Promise.all(
                _tempIds.map(async (templateId) => {
                  const flowList = await fetchFlowNodes(
                    spaceId,
                    String(templateId)
                  );
                  return flowList.data;
                })
              )) as FlowNode[];
              if (nodeFlowLists.length && nodeFlowLists?.[0]) {
                setSelectedTemplateId(nodeFlowLists?.[0]?.template_id);
              }
            }
          }
        })
        .catch((err) => {
          console.log("load batchRequestSender failed", err);
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (err) {
      console.log("load space failed", err);
    }
    fetchWorkObjectFields(spaceId, workObjectId).then((res) => {
      setFieldLists(res.data);
    });
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId || !workObjectId) {
      return;
    }
    sdk.WorkObject.load({
      spaceId: spaceId,
      workObjectId: workObjectId,
    }).then((res) => {
      setWorkItemName(res.name);
    });
  }, [spaceId, workObjectId]);

  useEffect(() => {
    if (selectedTemplateId) {
      if (nodeListByTemplateId.current?.[selectedTemplateId]) {
        setNodeLists(nodeListByTemplateId.current?.[selectedTemplateId]);
      }
      fetchFlowNodes(spaceId, String(selectedTemplateId)).then((res) => {
        if (
          !nodeListByTemplateId.current?.[selectedTemplateId] &&
          nodeListByTemplateId.current
        ) {
          nodeListByTemplateId.current[selectedTemplateId] = (
            res.data as { workflow_confs: WorkflowConfig[] }
          )?.workflow_confs;
        }
        setNodeLists(
          (res.data as { workflow_confs: WorkflowConfig[] })?.workflow_confs
        );
      });
    }
  }, [selectedTemplateId]);

  const showTips = useMemo(() => {
    if (tempIds?.length > 1) {
      return "当前的实例有多个模版，无法进行节点筛选，请重新选择模版一致的工作项实例列表";
    }
    return "";
  }, [tempIds.length]);

  const onSubmit = async () => {
    if (IsAggregated) {
      aggregatedSubmit();
      return;
    }
    setSaveLoading(true);
    const fields = {};
    try {
      const values = await formApi.validate();
      Object.keys(values).forEach((key) => {
        const fieldsObj = values[key];
        const _field: any[] = [];
        Object.keys(fieldsObj).forEach((k) => {
          const curField = fieldLists.find((i) => i.field_key === k);
          let field_value = fieldsObj[k];
          if (["select", "radio"].includes(curField.field_type_key)) {
            field_value = {
              value: fieldsObj[k],
              label: curField.options.find((i) => i.value === fieldsObj[k])
                ?.label,
            };
          }
          if (["multi_select"].includes(curField.field_type_key)) {
            const _field_value = curField.options.filter((i) =>
              fieldsObj[k].includes(i.value)
            );
            field_value = _field_value.map((i) => ({
              value: i.value,
              label: i.label,
            }));
          }
          if (["user"].includes(curField.field_type_key)) {
            field_value = Array.isArray(fieldsObj[k])
              ? fieldsObj[k][0]
              : fieldsObj[k];
          }
          _field.push({
            field_alias: curField.field_alias,
            field_key: k,
            field_type_key: curField.field_type_key,
            field_value,
          });
        });
        fields[key] = _field;
      });
      const selectItems = workItemsDetail.filter((item) => {
        const currentStateKeys = item.workflow_infos.workflow_nodes?.filter(
          (i) => i.status === 2
        );
        return (
          currentStateKeys.map((i) => i.state_key).includes(selectedNodeId) &&
          String(item.template_id) === String(selectedTemplateId)
        );
      });

      const requests = selectItems.slice(0, 500).map((item) => ({
        work_item_id: item.id, // 外部指定的work_item_id，这里从1000开始
        params: {
          projectKey: spaceId,
          workItemKey: item.work_item_type_key,
          workItemId: item.id,
          nodeId: selectedNodeId,
          fields: fields?.[item.id] ?? [],
          work_item_name: item.name,
        },
      }));
      const requestController = {
        abortAll: (() => void 0) as (() => void) | null,
        abortById: (() => false) as ((id: number) => boolean) | null,
      };

      // 启动并发请求（并发数5）
      const requestTask = batchConcurrentRequestController(
        requests,
        5,
        customExecutor
      );

      requestTask.then(({ abortAll, abortById }) => {
        requestController.abortAll = () => abortAll("User initiated cancel");
        requestController.abortById = (id) => abortById(id, "Canceled by user");
      });

      requestTask
        .then(({ allResults, isCanceled, err_msg }) => {
          // 统计结果
          const successCount = allResults.filter((r) => !r.err_msg).length;
          const cancelCount = allResults.filter((r) =>
            r.err_msg?.includes("aborted")
          ).length;
          const errorCount = allResults.length - successCount - cancelCount;
          setSuccessCount(successCount);
          if (errorCount !== 0) {
            setFailed(allResults.filter((r) => r.err_msg));
          }
        })
        .catch((err) => {
          console.error("err", err);
        })
        .finally(() => {
          setSaveLoading(false);
        });
    } catch (err) {
      console.log("onSubmit err", err);
    }
  };

  const aggregatedSubmit = async () => {
    setSaveLoading(true);
    const fields = {};
    try {
      const values = await formApi.validate();
      Object.keys(values).forEach((key) => {
        if (aggregatedFields.map((i) => String(i.id)).includes(key)) {
          const fieldsObj = values[key];
          const _field: any[] = [];
          Object.keys(fieldsObj).forEach((k) => {
            const curField = fieldLists.find((i) => i.field_key === k);
            let field_value = fieldsObj[k];
            if (["select", "radio"].includes(curField.field_type_key)) {
              field_value = {
                value: fieldsObj[k],
                label: curField.options.find((i) => i.value === fieldsObj[k])
                  ?.label,
              };
            }
            if (["multi_select"].includes(curField.field_type_key)) {
              const _field_value = curField.options.filter((i) =>
                fieldsObj[k].includes(i.value)
              );
              field_value = _field_value.map((i) => ({
                value: i.value,
                label: i.label,
              }));
            }
            if (["user"].includes(curField.field_type_key)) {
              field_value = Array.isArray(fieldsObj[k])
                ? fieldsObj[k][0]
                : fieldsObj[k];
            }
            _field.push({
              field_alias: curField.field_alias,
              field_key: k,
              field_type_key: curField.field_type_key,
              field_value,
            });
          });
          fields[key] = _field;
        }
      });
      const selectItems: any[] = [];
      aggregatedFields.forEach((item) => {
        const ids: any[] = item.children.map((it) => ({
          work_item_id: it.id,
          params: {
            projectKey: spaceId,
            workItemKey: it.work_item_type_key,
            workItemId: it.id,
            nodeId: selectedNodeId,
            fields: fields?.[item.id] ?? [],
            work_item_name: it.name,
          },
        }));
        selectItems.push(...ids);
      });
      const requests = selectItems.slice(0, 500);
      const requestController = {
        abortAll: (() => void 0) as (() => void) | null,
        abortById: (() => false) as ((id: number) => boolean) | null,
      };

      // 启动并发请求（并发数5）
      const requestTask = batchConcurrentRequestController(
        requests,
        5,
        customExecutor
      );

      requestTask.then(({ abortAll, abortById }) => {
        requestController.abortAll = () => abortAll("User initiated cancel");
        requestController.abortById = (id) => abortById(id, "Canceled by user");
      });

      requestTask
        .then(({ allResults, isCanceled, err_msg }) => {
          // if (isCanceled) {
          //   console.log(`请求已取消: ${err_msg}`);
          // } else {
          //   console.log(`所有${allResults.length}个请求处理完成`);
          // }
          // 统计结果
          const successCount = allResults.filter((r) => !r.err_msg).length;
          const cancelCount = allResults.filter((r) =>
            r.err_msg?.includes("aborted")
          ).length;
          const errorCount = allResults.length - successCount - cancelCount;
          setSuccessCount(successCount);
          if (errorCount !== 0) {
            setFailed(allResults.filter((r) => r.err_msg));
          }
        })
        .catch((err) => {
          console.log("err", err);
        })
        .finally(() => {
          setSaveLoading(false);
        });
    } catch (err) {
      console.log("aggregatedSubmit err", err);
    }
  };

  const filteredWorkItems = useMemo(() => {
    const _filterItems: any[] = [];
    workItemsDetail.forEach((item) => {
      const currentStateKeys = item.workflow_infos?.workflow_nodes?.filter(
        (i) => i.status === 2
      );
      if (currentStateKeys?.length === 0) {
        _filterItems.push(item);
      }
    });
    return _filterItems;
  }, [workItemsDetail]);

  useEffect(() => {
    if (
      workItemsDetail?.length === 0 ||
      !selectedNodeId ||
      !selectedTemplateId
    ) {
      return;
    }
    const _fields = {};
    const selectItems = workItemsDetail.filter((item) => {
      const currentStateKeys = item.workflow_infos.workflow_nodes?.filter(
        (i) => i.status === 2
      );
      if (
        currentStateKeys.map((i) => i.state_key).includes(selectedNodeId) &&
        String(item.template_id) === String(selectedTemplateId)
      ) {
        const currentStateKeysFields = item.workflow_infos.workflow_nodes.find(
          (i) => i.state_key === selectedNodeId
        )?.fields;
        (currentStateKeysFields ?? []).forEach((i) => {
          let _field_value = i.field_value;
          if (["multi_select"].includes(i.field_type_key)) {
            _field_value = i.field_value.map((i) => i.value);
          }
          if (["radio", "select"].includes(i.field_type_key)) {
            _field_value = i.field_value?.value;
          }
          if (["user"].includes(i.field_type_key)) {
            _field_value = [i.field_value];
          }
          if (!_fields[item.id]) {
            _fields[item.id] = {};
          }
          _fields[item.id][i.field_key] = _field_value;
        });

        return true;
      }
      return false;
    });
    if (selectItems?.length > 0) {
      fetchFormField(
        spaceId,
        workObjectId,
        selectItems?.[0].id,
        selectedNodeId
      ).then((res) => {
        console.log('res', res);
        
        setRequiredFields(res?.form_items?.map((i) => i.key));
      });
      formApi.setValues(_fields, {
        isOverride: true,
      });
    }
    setNodeBatch(selectItems?.length);
  }, [selectedTemplateId, selectedNodeId]);

  const formFields = useMemo(() => {
    if (workItemsDetail.length) {
      if (!IsAggregated) {
        return workItemsDetail.filter((item) => {
          const currentStateKeys = item.workflow_infos.workflow_nodes?.filter(
            (i) => i.status === 2
          );
          return (
            currentStateKeys.map((i) => i.state_key).includes(selectedNodeId) &&
            String(item.template_id) === String(selectedTemplateId)
          );
        });
      }
    }
    return [];
  }, [IsAggregated, selectedNodeId, workItemsDetail, selectedTemplateId]);

  const aggregatedFields = useMemo(() => {
    if (workItemsDetail.length) {
      if (IsAggregated) {
        const groupedFields = groupByFieldKey(workItemsDetail, selectedNodeId);
        return groupedFields;
      }
    }
    return [];
  }, [IsAggregated, selectedNodeId, workItemsDetail, selectedTemplateId]);

  if (!checkNode) {
    return <Text>请选择节点流进行流转</Text>;
  }

  if (showTips) {
    return <Text>{showTips}</Text>;
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxHeight: "calc(100vh - 80px)" }}>
        <Banner
          className="node-batch-banner"
          type="info"
          description={`已勾选「${workItemsDetail?.[0]?.name ?? ""}」等${
            selectedWorkItemIds.length
          }个项目`}
          closeIcon={null}
        />
        {filteredWorkItems.length ? (
          <Text style={{ marginTop: 8, display: "block" }}>
            已过滤掉 {filteredWorkItems.length}个非进行中的节点
          </Text>
        ) : null}
        {nodeBatch > 500 ? (
          <Text style={{ color: "red" }}>单次最多 500 个流转</Text>
        ) : null}
        {failed.length > 0 || successCount > 0 ? (
          <LogsModal
            logs={failed}
            successCount={successCount}
            spaceId={spaceId}
            workObjectId={workObjectId}
          />
        ) : (
          <>
            <div style={{ margin: "16px 0" }}>
              <Row>
                <Col
                  span={24}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  节点：
                  <Select
                    placeholder="请选择节点"
                    optionList={(nodeLists ?? []).map((i) => ({
                      label: i.name,
                      value: i.state_key,
                    }))}
                    value={selectedNodeId}
                    onChange={setSelectedNodeId}
                    style={{ width: 200 }}
                  ></Select>
                  {nodeBatch === 0 && selectedNodeId && (
                    <Text style={{ marginLeft: 12, color: "red" }}>
                      无符合条件的工作项实例
                    </Text>
                  )}
                </Col>
              </Row>
            </div>
            <Form
              labelAlign="left"
              labelPosition="left"
              labelWidth={180}
              getFormApi={setFormApi}
            >
              {/* 筛选出当前实例中进行中的节点是否包含在内 */}
              {selectedNodeId &&
                (!IsAggregated
                  ? formFields?.map((item) => {
                      const curStateFiels =
                        item.workflow_infos.workflow_nodes?.find(
                          (i) => i.state_key === selectedNodeId
                        )?.fields ?? [];
                      // 分组函数：将数组按指定大小分组
                      function groupArray(arr: any, groupSize: number) {
                        const groups: any = [];
                        for (let i = 0; i < arr.length; i += groupSize) {
                          groups.push(arr.slice(i, i + groupSize));
                        }
                        return groups;
                      }
                      const fileGroups = groupArray(curStateFiels, 6);
                      return (
                        <Row
                          style={{
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Col span={24}>
                            <Collapse
                              activeKey={selectedWIIds.map((i) => String(i))}
                              keepDOM={true}
                              className="node-flow-collapse"
                              collapseIcon={<IconSmallTriangleDown />}
                              expandIcon={<IconSmallTriangleRight />}
                              clickHeaderToExpand={false}
                              onChange={(activeKey) => {
                                setSelectedWIIds(activeKey);
                              }}
                            >
                              <Collapse.Panel
                                header={
                                  <Text
                                    link
                                    ellipsis={{
                                      showTooltip: true,
                                      pos: "middle",
                                    }}
                                    // style={{ width: "100%" }}
                                    onClick={async () => {
                                      const space = await sdk.Space.load(
                                        spaceId || ""
                                      );
                                      sdk.navigation.open(
                                        `/${space.simpleName}/${workObjectId}/detail/${item?.id}`,
                                        "_blank"
                                      );
                                    }}
                                  >
                                    {item.name}
                                  </Text>
                                }
                                itemKey={String(item.id)}
                              >
                                {fileGroups?.length > 0 ? (
                                  fileGroups?.map(
                                    (group: any[], groupIndex) => {
                                      return (
                                        <Row>
                                          {group?.map((_item, itemIndex) => {
                                            return (
                                              <Col span={24}>
                                                <ItemCol
                                                  item={_item}
                                                  fieldList={fieldLists}
                                                  workItemId={item.id}
                                                  requiredFields={
                                                    requiredFields
                                                  }
                                                  spaceId={spaceId}
                                                  workObjectId={workObjectId}
                                                  formApi={formApi}
                                                  workItemName={workItemName}
                                                />
                                              </Col>
                                            );
                                          })}
                                        </Row>
                                      );
                                    }
                                  )
                                ) : (
                                  <div style={{ paddingBottom: 8 }}>
                                    无节点表单信息
                                  </div>
                                )}
                              </Collapse.Panel>
                            </Collapse>
                          </Col>
                        </Row>
                      );
                    })
                  : aggregatedFields.map((aggregatedItem) => {
                      if (aggregatedItem.children?.length) {
                        const firstItem = aggregatedItem.children[0];
                        // const allIds = aggregatedItem.children.map((i) => i.id);
                        const curStateFiels =
                          firstItem.workflow_infos.workflow_nodes?.find(
                            (i) => i.state_key === selectedNodeId
                          )?.fields ?? [];
                        // 分组函数：将数组按指定大小分组
                        function groupArray(arr: any, groupSize: number) {
                          const groups: any = [];
                          for (let i = 0; i < arr.length; i += groupSize) {
                            groups.push(arr.slice(i, i + groupSize));
                          }
                          return groups;
                        }
                        const fileGroups = groupArray(curStateFiels, 1);
                        return (
                          <Row
                            style={{
                              marginBottom: 8,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <Col span={24}>
                              <div
                                style={{
                                  border: "1px solid var(--semi-color-border)",
                                  boxShadow: "var(--semi-shadow-S1-down)",
                                  borderRadius:
                                    "var(--semi-border-radius-medium)",
                                  background: "var(--semi-color-bg-2)",
                                  marginBottom: 8,
                                  padding: 12,
                                }}
                                className="form-wrap"
                              >
                                <div
                                  style={{
                                    borderBottom:
                                      "1px solid var(--semi-color-border)",
                                    paddingBottom: 8,
                                    marginBottom: 8,
                                  }}
                                >
                                  筛选出的实例：
                                  {aggregatedItem.children.map((nameItems) => (
                                    <Text
                                      link
                                      ellipsis={{
                                        showTooltip: true,
                                        pos: "middle",
                                      }}
                                      onClick={async () => {
                                        const space = await sdk.Space.load(
                                          spaceId || ""
                                        );
                                        sdk.navigation.open(
                                          `/${space.simpleName}/${workObjectId}/detail/${nameItems?.id}`,
                                          "_blank"
                                        );
                                      }}
                                    >
                                      {`${nameItems.name}，`}
                                    </Text>
                                  ))}
                                </div>
                                {fileGroups?.length > 0 ? (
                                  fileGroups?.map(
                                    (group: any[], groupIndex) => {
                                      return (
                                        <Row>
                                          {group?.map((_item, itemIndex) => {
                                            return (
                                              <Col span={24}>
                                                <ItemCol
                                                  item={_item}
                                                  fieldList={fieldLists}
                                                  workItemId={aggregatedItem.id}
                                                  requiredFields={
                                                    requiredFields
                                                  }
                                                  spaceId={spaceId}
                                                  workObjectId={workObjectId}
                                                  formApi={formApi}
                                                  workItemName={workItemName}
                                                />
                                              </Col>
                                            );
                                          })}
                                        </Row>
                                      );
                                    }
                                  )
                                ) : (
                                  <div style={{ paddingBottom: 8 }}>
                                    无节点表单信息
                                  </div>
                                )}
                              </div>
                            </Col>
                          </Row>
                        );
                      }
                    }))}
            </Form>
            <Button
              style={{
                position: "fixed",
                right: 0,
                top: "93vh",
                backgroundColor: "#005BAC",
                color: "#fff",
              }}
              theme="solid"
              onClick={onSubmit}
              loading={saveLoading}
              disabled={!(selectedNodeId && nodeBatch > 0)}
            >
              批量提交
            </Button>
          </>
        )}
      </div>
    </Spin>
  );
};

export default NodeFlow;
