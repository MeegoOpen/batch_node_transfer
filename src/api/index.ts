import request, { limitPost } from "./request";

export interface ResponseWrap<D> {
  code: number;
  msg: string;
  data?: D;
  error?: {
    id: number;
    localizedMessage: {
      locale: string;
      message: string;
    };
  };
  logId?: string;
}

interface WorkItemDetailReq {
  project_key: string;
  work_item_type_key: string;
  work_item_ids: number[];
  expand?: {
    need_workflow: boolean; // 是否返回工作流信息
    need_multi_text: boolean; // 是否返回富文本
    need_user_detail: boolean; // 是否返回用户详情
    need_sub_task_parent: boolean; // 是否返回子任务相关信息
    relation_fields_detail: boolean; // 是否返回关联字段详情
  };
}

export enum DisabledState {
  Disabled = 1,
  Enabled,
}

export enum NodePassMode {
  AUTO_FINISH = 1,
  SINGLE_CONFIRM,
  MULTIPLE_CONFIRM,
}

export interface StateflowConfig {
  authorized_roles: string[];
  name: string;
  state_key: string;
  state_type: number;
}

export interface WorkflowConfig {
  deletable: boolean;
  deletable_operation_role: string[];
  different_schedule: boolean;
  done_allocate_owner: boolean;
  done_operation_role: string[];
  done_schedule: boolean;
  is_limit_node: boolean;
  name: string;
  need_schedule: boolean;
  owner_roles: string[];
  owner_usage_mode: number;
  owners: string[];
  pass_mode: NodePassMode;
  state_key: string;
  tags: string[];
  visibility_usage_mode: number;
}

interface Connection {
  source_state_key: string;
  target_state_key: string;
  transition_id?: number;
}

export interface FlowNode {
  template_id: number;
  template_name: string;
  version: number;
  is_disabled: DisabledState;
  state_flow_confs: StateflowConfig[] | null;
  workflow_confs: WorkflowConfig[] | null;
  connections: Connection[];
}

/**
 * 节点状态，1：未开始，2：进行中，3：已完成
 */
export enum INodeStatus {
  NotStart = 1,
  Doing = 2,
  Done = 3,
}
export interface ISchedules {
  estimate_end_date: number;
  estimate_start_date: number;
  owners: string[];
  points: number;
}
export interface ISubtasks {
  id: string;
  name: string;
  order: number;
  owners: string[];
  schedules: Array<ISchedules>;
  passed: boolean; // 是否完成
}
// 获取流程节点
export const fetchFlowNodes = (projectKey: string, templateId: string) =>
  request
    .get<unknown, ResponseWrap<FlowNode>>(
      `/open_api/${projectKey}/template_detail/${Number(templateId)}`
    )
    .then((res) => {
      if (res?.code === 0) {
        if (typeof res.data === "object") {
          if (!Array.isArray(res.data.state_flow_confs)) {
            res.data.state_flow_confs = [];
          }
          if (!Array.isArray(res.data.workflow_confs)) {
            res.data.workflow_confs = [];
          }
        }
        return res;
      }
      return { data: {} };
    })
    .catch((err) => {
      return { data: {} };
    });
export interface IWorkflowDetail {
  connections: {
    source_state_key: string;
    target_state_key: string;
  }[];
  workflow_nodes: Array<{
    id: string;
    state_key: string;
    name: string;
    status: INodeStatus;
    node_schedule: ISchedules;
    owners: string[];
    milestone: boolean;
    sub_tasks: Array<ISubtasks>;
  }>;
}
// 表单字段详情
export const getWorkItemFieldDetail = async (params: WorkItemDetailReq) =>
  limitPost<unknown, ResponseWrap<any>>(
    `/open_api/${params.project_key}/work_item/${params.work_item_type_key}/query`,
    params
  )
    .then((res) => {
      if (res?.code === 0) {
        return res?.data;
      }
    })
    .catch((err) => {
      return {};
    });

// 获取工作流详情
export const fetchWorkflowDetail = (
  projectKey: string,
  workItemKey: string,
  workItemId: number
) =>
  limitPost<unknown, ResponseWrap<IWorkflowDetail>>(
    `/open_api/${projectKey}/work_item/${workItemKey}/${workItemId}/workflow/query`,
    {
      project_key: projectKey,
      work_item_type_key: workItemKey,
      work_item_id: workItemId,
    }
  ).then((res) => {
    const { code, data, msg } = res;
    return { err_code: code, data, msg };
  });

// 获取流程节点
export interface FlowNode2 {
  key: string;
  name: string;
  type: number; // 1-auto finish, 2-not auto finish
}

interface FieldOption {
  label: string;
  value: string | number;
  children?: FieldOption[];
}

export type FieldTypeKey = keyof typeof FIELD_TYPE_NAME;

export const FIELD_TYPE_NAME = {
  text: () => "文本", //
  multi_pure_text: () => "多行文本", //
  link: () => "链接", //
  date: () => "日期", //
  schedule: () => "日期区间", //
  precise_date: () => "日期+时间", //
  number: () => "数字", // 数字
  work_item_related_select: () => "关联工作项", // 关联工作项
  work_item_related_multi_select: () => "多选关联工作项", //
  signal: () => "信号", //信号
  bool: () => "开关", // 开关
  radio: () => "单选按钮", //单选按钮
  select: () => "单选", // 单选
  multi_select: () => "多选", //多选
  tree_select: () => "级联单选", //
  tree_multi_select: () => "级联多选", // 级联多选
  user: () => "单选人员", //单选人员
  multi_user: () => "多选人员", //多选人员
  compound_field: () => "复合字段", // 复合字段
  multi_text: () => "富文本", // 富文本
  file: () => "文件", //文件
  multi_file: () => "附件", //附件
  aborted: () => "终止", //终止
  deleted: () => "删除", //删除
  role_owners: () => "角色人员", //角色人员
  linked_work_item: () => "关联工作项", //关联工作项
  business: () => "业务线", //业务线
  chat_group: () => "群id", //群id
  group_id: () => "群id", // 群id
  group_type: () => "拉群方式", //拉群方式
  work_item_template: () => "模板类型", //模板类型
  work_item_status: () => "工作项状态", //工作项状态
  vote_option: () => "投票", //投票
  vote_option_multi: () => "多选投票", //多选投票
};

export interface WorkObjectField {
  field_alias?: string;
  field_key: string;
  field_name: string;
  field_type_key: FieldTypeKey;
  is_custom_field?: boolean;
  is_obsoleted?: boolean;
  options?: FieldOption[];
  compound_fields?: WorkObjectField[];
  required?: boolean;
  value_generate_mode: "Default" | "Calculate";
  flag?: string; // buildin 标识内置字段
}

export const fetchWorkObjectFields = (
  projectKey: string,
  workItemKey: string
) =>
  limitPost<
    unknown,
    {
      data: WorkObjectField[];
      code: number;
      err_code: number;
      msg: string;
    }
  >(`/open_api/${projectKey}/field/all`, {
    project_key: projectKey,
    work_item_type_key: workItemKey,
  })
    .then((res) => {
      // hard code，「缺陷」的报告人和经办人之前是字段，后来迁移为了角色，为了兼容性一直保留呢，这里要过滤掉
      if (res?.code === 0 && res?.data && Array.isArray(res.data)) {
        res.data = res.data.filter(
          (fd) => !["issue_operator", "issue_reporter"].includes(fd.field_key)
        );
        return { ...res, err_code: res.code, err_msg: res.msg };
      } else {
        return {
          data: [],
          code: -1,
          err_code: -1,
          msg: "error",
        };
      }
    })
    .catch((err) => {
      return {
        data: [],
        code: -1,
        err_code: -1,
        msg: "error",
      };
    });

export const nodeOperation = ({
  projectKey,
  workItemKey,
  workItemId,
  nodeId,
  fields,
}: {
  projectKey: string;
  workItemKey: string;
  workItemId: number;
  nodeId: string;
  fields?: {
    field_key: string;
    field_alias?: string;
    field_value: any;
    field_type_key: string;
    target_state?: {
      state_key: string;
      transition_id: number;
    };
  };
}) =>
  limitPost<unknown, ResponseWrap<FlowNode2[]>>(
    `/open_api/${projectKey}/workflow/${workItemKey}/${workItemId}/node/${nodeId}/operate`,
    {
      action: "confirm",
      project_key: projectKey,
      work_item_type_key: workItemKey,
      work_item_id: workItemId,
      node_id: nodeId,
      fields,
    }
  )
    .then((res) => {
      return Array.isArray(res.data) ? res.data : [];
    })
    .catch((err) => {
      return [];
    });

export const fetchFormField = (
  projectKey: string,
  workItemType: string,
  workItemId: number,
  stateKey: string
): any =>
  limitPost<
    unknown,
    ResponseWrap<{
      form_items: {
        class: string;
        field_type_key: string;
        finished: boolean;
        key: string;
      }[];
      node_fields: {
        field_key: string;
        field_type_key: string;
        finished: boolean;
      }[];
    }>
  >(`/open_api/work_item/transition_required_info/get`, {
    project_key: projectKey,
    work_item_type_key: workItemType,
    work_item_id: workItemId,
    state_key: stateKey,
  })
    .then((res) => {
      if (res.code === 0) {
        return res.data;
      }
      return {
        form_items: [],
      };
    })
    .catch((err) => {
      return { form_items: [] };
    });
